import crypto from "node:crypto";
import { validateDecision } from "./decision-validator.mjs";
import validateGeneratedDecision, { decisionSchemaSha256 } from "../generated/decision-schema-validator.mjs";

function getSchemaNode(schema, dottedPath) {
  return dottedPath.split(".").reduce((node, part) => node?.[part], schema);
}

function sorted(values) {
  return [...values].sort();
}

function arraysEqual(a, b) {
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function schemaSha256(schema) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(schema))).digest("hex");
}

function schemaMatchesGeneratedValidator(schema) {
  return schema && typeof schema === "object" && !Array.isArray(schema) && schemaSha256(schema) === decisionSchemaSha256;
}

const expectedEnums = {
  "properties.decision.enum": ["NO_GO", "PLAN_ONLY", "RUN_WITH_CONTRACT"],
  "properties.recommended_surface.enum": ["manual", "plan", "goal", "loop", "routine"],
  "properties.confidence.enum": ["low", "medium", "high"],
  "$defs.hostCapabilities.properties.host.enum": ["codex", "claude_code", "unknown"],
  "$defs.hostCapabilities.properties.capability_confidence.enum": ["known", "unknown"],
  "$defs.hostCapabilities.properties.supported_surfaces.items.enum": ["goal", "loop", "routine"],
  "properties.plan_outputs.items.enum": ["risk_analysis", "task_breakdown", "candidate_gate", "read_only_review", "implementation_plan"],
  "properties.required_user_confirmation.items.enum": ["dependency_setup", "external_access", "large_diff", "config_change", "risky_path", "write_files", "run_commands", "save_files"],
  "properties.contract.properties.allowed_actions.items.enum": ["read_files", "read_external_state", "read_external_source", "edit_small_scope", "run_test_command", "run_lint_command", "install_locked_dependencies", "create_report", "ask_user"],
  "properties.contract.properties.forbidden_actions.items.enum": ["edit_secrets", "change_auth_or_payment", "mutate_dependencies", "git_commit", "git_push", "deploy", "delete_files", "large_refactor", "mutate_external_state"],
  "properties.contract.properties.gate.properties.type.enum": ["command", "checklist", "file_output", "report_review"],
  "properties.contract.properties.stop_conditions.items.enum": ["gate_passes", "max_rounds_reached", "same_failure_twice", "forbidden_action_needed", "user_interrupt", "scope_expands", "no_progress"],
  "properties.contract.properties.human_confirmations.items.enum": ["dependency_setup", "external_access", "large_diff", "config_change", "risky_path", "write_files", "run_commands", "save_files"],
  "properties.contract.properties.report.items.enum": ["what_changed", "commands_run", "gate_result", "risks_or_blockers", "next_steps", "files_touched", "rounds_used"],
};

export function validateJsonSchema(value, schema, path = "value") {
  if (!schemaMatchesGeneratedValidator(schema)) {
    return [`${path}: schema differs from the generated runtime validator; regenerate or reinstall LoopPilot`];
  }
  const valid = validateGeneratedDecision(value);
  if (valid) return [];
  return (validateGeneratedDecision.errors ?? []).map((error) => {
    const location = error.instancePath ? `${path}${error.instancePath}` : path;
    return `${location}: ${error.message ?? error.keyword}`;
  });
}

export function validateDecisionSchemaDefinition(schema) {
  const errors = [];
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return ["schema: must be an object"];
  }

  if (schema.additionalProperties !== false) errors.push("schema.additionalProperties: must be false");
  if (schema.$id !== "https://looppilot.local/schemas/decision-schema-v2.json") {
    errors.push("schema.$id: must identify decision schema v2");
  }
  if (!schemaMatchesGeneratedValidator(schema)) {
    errors.push("schema: differs from the generated runtime validator");
  }
  const required = getSchemaNode(schema, "required") ?? [];
  const expectedTopLevel = [
    "decision",
    "recommended_surface",
    "confidence",
    "needs_clarification",
    "clarifying_question",
    "host_capabilities",
    "reasons",
    "safe_alternative",
    "next_prompt",
    "plan_outputs",
    "required_user_confirmation",
    "contract",
  ];
  if (!arraysEqual(required, expectedTopLevel)) {
    errors.push("schema.required: top-level required fields drifted from validator contract");
  }

  for (const [path, expected] of Object.entries(expectedEnums)) {
    const actual = getSchemaNode(schema, path);
    if (!Array.isArray(actual)) errors.push(`${path}: enum is missing`);
    else if (!arraysEqual(actual, expected)) errors.push(`${path}: enum drifted from validator contract`);
  }

  const contractRequired = getSchemaNode(schema, "properties.contract.required") ?? [];
  const expectedContractRequired = [
    "goal",
    "scope",
    "allowed_actions",
    "forbidden_actions",
    "surface_config",
    "gate",
    "stop_conditions",
    "max_rounds",
    "host_capabilities",
    "human_confirmations",
    "report",
  ];
  if (!arraysEqual(contractRequired, expectedContractRequired)) {
    errors.push("properties.contract.required: contract required fields drifted from validator contract");
  }

  const conditionalContract = schema.allOf?.find((entry) => entry?.if?.properties?.decision?.const === "RUN_WITH_CONTRACT");
  if (!conditionalContract) {
    errors.push("schema.allOf: must enforce contract shape by decision");
  } else {
    const thenType = conditionalContract.then?.properties?.contract?.type;
    const elseType = conditionalContract.else?.properties?.contract?.type;
    if (thenType !== "object") errors.push("schema.allOf.then.properties.contract.type: must be object");
    if (elseType !== "null") errors.push("schema.allOf.else.properties.contract.type: must be null");
  }

  return errors;
}

export function validateDecisionAgainstSchema(decision, schema, path = "decision") {
  const schemaErrors = validateDecisionSchemaDefinition(schema).map((error) => `schema:${error}`);
  const runtimeSchemaErrors = schemaErrors.length === 0
    ? validateJsonSchema(decision, schema, path).map((error) => `json-schema:${error}`)
    : [];
  const decisionErrors = validateDecision(decision, path).map((error) => `safety:${error}`);
  return [...schemaErrors, ...runtimeSchemaErrors, ...decisionErrors];
}
