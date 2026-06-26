import { validateDecision } from "./decision-validator.mjs";

function getSchemaNode(schema, dottedPath) {
  return dottedPath.split(".").reduce((node, part) => node?.[part], schema);
}

function sorted(values) {
  return [...values].sort();
}

function arraysEqual(a, b) {
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

const expectedEnums = {
  "properties.decision.enum": ["NO_GO", "PLAN_ONLY", "RUN_WITH_CONTRACT"],
  "properties.confidence.enum": ["low", "medium", "high"],
  "$defs.hostCapabilities.properties.host.enum": ["codex", "claude_code", "unknown"],
  "$defs.hostCapabilities.properties.capability_confidence.enum": ["known", "unknown"],
  "properties.plan_outputs.items.enum": ["risk_analysis", "task_breakdown", "candidate_gate", "read_only_review", "implementation_plan"],
  "properties.required_user_confirmation.items.enum": ["dependency_install", "large_diff", "config_change", "risky_path", "write_files", "run_commands", "save_files"],
  "properties.contract.properties.allowed_actions.items.enum": ["read_files", "edit_small_scope", "run_test_command", "run_lint_command", "create_report", "ask_user"],
  "properties.contract.properties.forbidden_actions.items.enum": ["edit_secrets", "change_auth_or_payment", "install_dependencies", "git_commit", "git_push", "deploy", "delete_files", "large_refactor"],
  "properties.contract.properties.gate.properties.type.enum": ["command", "checklist", "file_output", "report_review"],
  "properties.contract.properties.stop_conditions.items.enum": ["gate_passes", "max_rounds_reached", "same_failure_twice", "forbidden_action_needed", "user_interrupt", "scope_expands", "no_progress"],
  "properties.contract.properties.human_confirmations.items.enum": ["dependency_install", "large_diff", "config_change", "risky_path", "write_files", "run_commands", "save_files"],
  "properties.contract.properties.report.items.enum": ["what_changed", "commands_run", "gate_result", "risks_or_blockers", "next_steps", "files_touched", "rounds_used"],
};

function resolveRef(schema, ref) {
  if (!ref.startsWith("#")) throw new Error(`unsupported non-local $ref ${ref}`);
  return ref.slice(2).split("/").filter(Boolean).reduce((node, segment) => node?.[segment], schema);
}

function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function validateJsonSchemaNode(value, node, rootSchema, path, errors) {
  if (!node || typeof node !== "object") return;
  if (node.$ref) {
    const resolved = resolveRef(rootSchema, node.$ref);
    if (!resolved) {
      errors.push(`${path}: unresolved $ref ${node.$ref}`);
      return;
    }
    validateJsonSchemaNode(value, resolved, rootSchema, path, errors);
    return;
  }

  if (node.type) {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (!types.some((type) => typeMatches(value, type))) {
      errors.push(`${path}: expected type ${types.join("|")}`);
      return;
    }
  }

  if (node.enum && !node.enum.some((entry) => Object.is(entry, value))) {
    errors.push(`${path}: value ${JSON.stringify(value)} is not in enum`);
  }

  if (typeof value === "string") {
    if (node.minLength !== undefined && value.length < node.minLength) {
      errors.push(`${path}: string shorter than minLength ${node.minLength}`);
    }
  }

  if (typeof value === "number") {
    if (node.minimum !== undefined && value < node.minimum) errors.push(`${path}: number below minimum ${node.minimum}`);
    if (node.maximum !== undefined && value > node.maximum) errors.push(`${path}: number above maximum ${node.maximum}`);
  }

  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) errors.push(`${path}: array shorter than minItems ${node.minItems}`);
    if (node.uniqueItems) {
      const seen = new Set();
      value.forEach((item, index) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) errors.push(`${path}[${index}]: duplicate item`);
        seen.add(key);
      });
    }
    if (node.items) {
      value.forEach((item, index) => validateJsonSchemaNode(item, node.items, rootSchema, `${path}[${index}]`, errors));
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const properties = node.properties ?? {};
    for (const key of node.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key}: is required`);
    }
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) errors.push(`${path}.${key}: additional property is not allowed`);
      }
    }
    for (const [key, childNode] of Object.entries(properties)) {
      if (key in value) validateJsonSchemaNode(value[key], childNode, rootSchema, `${path}.${key}`, errors);
    }
  }
}

export function validateJsonSchema(value, schema, path = "value") {
  const errors = [];
  try {
    validateJsonSchemaNode(value, schema, schema, path, errors);
  } catch (error) {
    errors.push(`${path}: schema evaluation failed: ${error.message}`);
  }
  return errors;
}

export function validateDecisionSchemaDefinition(schema) {
  const errors = [];
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return ["schema: must be an object"];
  }

  if (schema.additionalProperties !== false) errors.push("schema.additionalProperties: must be false");
  const required = getSchemaNode(schema, "required") ?? [];
  const expectedTopLevel = [
    "decision",
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

  return errors;
}

export function validateDecisionAgainstSchema(decision, schema, path = "decision") {
  const schemaErrors = validateDecisionSchemaDefinition(schema).map((error) => `schema:${error}`);
  const runtimeSchemaErrors = validateJsonSchema(decision, schema, path).map((error) => `json-schema:${error}`);
  const decisionErrors = validateDecision(decision, path).map((error) => `safety:${error}`);
  return [...schemaErrors, ...runtimeSchemaErrors, ...decisionErrors];
}
