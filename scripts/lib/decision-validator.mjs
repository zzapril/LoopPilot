import fs from "node:fs";

const DECISIONS = new Set(["NO_GO", "PLAN_ONLY", "RUN_WITH_CONTRACT"]);
const CONFIDENCE = new Set(["low", "medium", "high"]);
const HOSTS = new Set(["codex", "claude_code", "unknown"]);
const CAPABILITY_CONFIDENCE = new Set(["known", "unknown"]);
const PLAN_OUTPUTS = new Set([
  "risk_analysis",
  "task_breakdown",
  "candidate_gate",
  "read_only_review",
  "implementation_plan",
]);
const CONFIRMATIONS = new Set([
  "dependency_install",
  "large_diff",
  "config_change",
  "risky_path",
  "write_files",
  "run_commands",
  "save_files",
]);
const ALLOWED_ACTIONS = new Set([
  "read_files",
  "edit_small_scope",
  "run_test_command",
  "run_lint_command",
  "create_report",
  "ask_user",
]);
const FORBIDDEN_ACTIONS = new Set([
  "edit_secrets",
  "change_auth_or_payment",
  "install_dependencies",
  "git_commit",
  "git_push",
  "deploy",
  "delete_files",
  "large_refactor",
]);
const GATE_TYPES = new Set(["command", "checklist", "file_output", "report_review"]);
const STOP_CONDITIONS = new Set([
  "gate_passes",
  "max_rounds_reached",
  "same_failure_twice",
  "forbidden_action_needed",
  "user_interrupt",
  "scope_expands",
  "no_progress",
]);
const REPORT_FIELDS = new Set([
  "what_changed",
  "commands_run",
  "gate_result",
  "risks_or_blockers",
  "next_steps",
  "files_touched",
  "rounds_used",
]);

const REQUIRED_TOP_LEVEL = [
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

const HOST_CAPABILITY_KEYS = [
  "host",
  "can_edit_files",
  "can_run_commands",
  "has_approval_flow",
  "supports_skills_or_commands",
  "capability_confidence",
];

function fail(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateStringArray(value, allowedSet, path, errors, options = {}) {
  if (!Array.isArray(value)) {
    fail(errors, path, "must be an array");
    return;
  }

  const seen = new Set();
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || entry.length === 0) {
      fail(errors, `${path}[${index}]`, "must be a non-empty string");
      return;
    }
    if (allowedSet && !allowedSet.has(entry)) {
      fail(errors, `${path}[${index}]`, `unsupported value ${JSON.stringify(entry)}`);
    }
    if (seen.has(entry)) {
      fail(errors, `${path}[${index}]`, `duplicate value ${JSON.stringify(entry)}`);
    }
    seen.add(entry);
  });

  if (options.minItems && value.length < options.minItems) {
    fail(errors, path, `must contain at least ${options.minItems} item(s)`);
  }
}

export function readJsonFile(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

export function readJsonlFile(path) {
  const text = fs.readFileSync(path, "utf8").trim();
  if (!text) return [];
  return text.split(/\n/).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${path}:${index + 1}: invalid JSON: ${error.message}`);
    }
  });
}

export function validateHostCapabilities(host, path = "host_capabilities") {
  const errors = [];
  if (!isObject(host)) {
    fail(errors, path, "must be an object");
    return errors;
  }

  const required = [
    "host",
    "can_edit_files",
    "can_run_commands",
    "has_approval_flow",
    "supports_skills_or_commands",
    "capability_confidence",
  ];
  for (const key of required) {
    if (!(key in host)) fail(errors, `${path}.${key}`, "is required");
  }

  if (!HOSTS.has(host.host)) fail(errors, `${path}.host`, "must be codex, claude_code, or unknown");
  for (const key of ["can_edit_files", "can_run_commands", "has_approval_flow", "supports_skills_or_commands"]) {
    if (typeof host[key] !== "boolean") fail(errors, `${path}.${key}`, "must be boolean");
  }
  if (!CAPABILITY_CONFIDENCE.has(host.capability_confidence)) {
    fail(errors, `${path}.capability_confidence`, "must be known or unknown");
  }

  return errors;
}

export function validateContract(contract, decisionHost, path = "contract") {
  const errors = [];
  if (!isObject(contract)) {
    fail(errors, path, "must be an object for RUN_WITH_CONTRACT");
    return errors;
  }

  const required = [
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
  for (const key of required) {
    if (!(key in contract)) fail(errors, `${path}.${key}`, "is required");
  }

  if (typeof contract.goal !== "string" || contract.goal.length === 0) {
    fail(errors, `${path}.goal`, "must be a non-empty string");
  }

  if (!isObject(contract.scope)) {
    fail(errors, `${path}.scope`, "must be an object");
  } else {
    validateStringArray(contract.scope.include, null, `${path}.scope.include`, errors);
    validateStringArray(contract.scope.exclude, null, `${path}.scope.exclude`, errors);
  }

  validateStringArray(contract.allowed_actions, ALLOWED_ACTIONS, `${path}.allowed_actions`, errors, { minItems: 1 });
  validateStringArray(contract.forbidden_actions, FORBIDDEN_ACTIONS, `${path}.forbidden_actions`, errors, { minItems: 1 });

  for (const requiredForbidden of ["edit_secrets", "install_dependencies", "git_commit", "git_push", "deploy"]) {
    if (!contract.forbidden_actions?.includes(requiredForbidden)) {
      fail(errors, `${path}.forbidden_actions`, `must include ${requiredForbidden}`);
    }
  }

  if (!isObject(contract.gate)) {
    fail(errors, `${path}.gate`, "must be an object");
  } else {
    if (!GATE_TYPES.has(contract.gate.type)) fail(errors, `${path}.gate.type`, "unsupported gate type");
    if (!(typeof contract.gate.command === "string" || contract.gate.command === null)) {
      fail(errors, `${path}.gate.command`, "must be string or null");
    }
    if (typeof contract.gate.expect !== "string" || contract.gate.expect.length === 0) {
      fail(errors, `${path}.gate.expect`, "must be a non-empty string");
    }
  }

  validateStringArray(contract.stop_conditions, STOP_CONDITIONS, `${path}.stop_conditions`, errors, { minItems: 2 });
  for (const requiredStop of ["max_rounds_reached", "forbidden_action_needed", "user_interrupt"]) {
    if (!contract.stop_conditions?.includes(requiredStop)) {
      fail(errors, `${path}.stop_conditions`, `must include ${requiredStop}`);
    }
  }

  if (!Number.isInteger(contract.max_rounds) || contract.max_rounds < 1 || contract.max_rounds > 10) {
    fail(errors, `${path}.max_rounds`, "must be an integer from 1 to 10");
  }

  errors.push(...validateHostCapabilities(contract.host_capabilities, `${path}.host_capabilities`));
  if (decisionHost && isObject(contract.host_capabilities)) {
    for (const key of HOST_CAPABILITY_KEYS) {
      if (contract.host_capabilities[key] !== decisionHost[key]) {
        fail(errors, `${path}.host_capabilities.${key}`, "must match decision host capabilities");
      }
    }
  }

  if (contract.host_capabilities?.host === "unknown") {
    fail(errors, `${path}.host_capabilities.host`, "cannot be unknown for RUN_WITH_CONTRACT");
  }
  if (contract.host_capabilities?.supports_skills_or_commands !== true) {
    fail(errors, `${path}.host_capabilities.supports_skills_or_commands`, "must be true for RUN_WITH_CONTRACT");
  }
  if (contract.allowed_actions?.includes("edit_small_scope") && contract.host_capabilities?.can_edit_files !== true) {
    fail(errors, `${path}.host_capabilities.can_edit_files`, "must be true when the contract allows edits");
  }
  if (
    (contract.allowed_actions?.includes("run_test_command")
      || contract.allowed_actions?.includes("run_lint_command")
      || contract.gate?.type === "command")
    && contract.host_capabilities?.can_run_commands !== true
  ) {
    fail(errors, `${path}.host_capabilities.can_run_commands`, "must be true when the contract uses command gates");
  }
  if (Array.isArray(contract.human_confirmations) && contract.human_confirmations.length > 0 && contract.host_capabilities?.has_approval_flow !== true) {
    fail(errors, `${path}.host_capabilities.has_approval_flow`, "must be true when the contract requires human confirmations");
  }

  validateStringArray(contract.human_confirmations, CONFIRMATIONS, `${path}.human_confirmations`, errors);
  validateStringArray(contract.report, REPORT_FIELDS, `${path}.report`, errors, { minItems: 3 });

  return errors;
}

export function validateDecision(decision, path = "decision") {
  const errors = [];
  if (!isObject(decision)) {
    fail(errors, path, "must be an object");
    return errors;
  }

  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in decision)) fail(errors, `${path}.${key}`, "is required");
  }

  const allowedKeys = new Set(REQUIRED_TOP_LEVEL);
  for (const key of Object.keys(decision)) {
    if (!allowedKeys.has(key)) fail(errors, `${path}.${key}`, "is not allowed");
  }

  if (!DECISIONS.has(decision.decision)) fail(errors, `${path}.decision`, "unsupported decision");
  if (!CONFIDENCE.has(decision.confidence)) fail(errors, `${path}.confidence`, "unsupported confidence");
  if (typeof decision.needs_clarification !== "boolean") {
    fail(errors, `${path}.needs_clarification`, "must be boolean");
  }
  if (!(typeof decision.clarifying_question === "string" || decision.clarifying_question === null)) {
    fail(errors, `${path}.clarifying_question`, "must be string or null");
  }
  if (decision.needs_clarification && !decision.clarifying_question) {
    fail(errors, `${path}.clarifying_question`, "is required when needs_clarification is true");
  }

  errors.push(...validateHostCapabilities(decision.host_capabilities, `${path}.host_capabilities`));
  validateStringArray(decision.reasons, null, `${path}.reasons`, errors, { minItems: 1 });
  validateStringArray(decision.plan_outputs, PLAN_OUTPUTS, `${path}.plan_outputs`, errors);
  validateStringArray(decision.required_user_confirmation, CONFIRMATIONS, `${path}.required_user_confirmation`, errors);

  if (!(typeof decision.safe_alternative === "string" || decision.safe_alternative === null)) {
    fail(errors, `${path}.safe_alternative`, "must be string or null");
  }
  if (!(typeof decision.next_prompt === "string" || decision.next_prompt === null)) {
    fail(errors, `${path}.next_prompt`, "must be string or null");
  }

  if (decision.decision === "RUN_WITH_CONTRACT") {
    if (decision.needs_clarification) {
      fail(errors, `${path}.needs_clarification`, "must be false for RUN_WITH_CONTRACT");
    }
    if (decision.host_capabilities?.capability_confidence !== "known") {
      fail(errors, `${path}.host_capabilities.capability_confidence`, "must be known for RUN_WITH_CONTRACT");
    }
    if (decision.host_capabilities?.host === "unknown") {
      fail(errors, `${path}.host_capabilities.host`, "cannot be unknown for RUN_WITH_CONTRACT");
    }
    if (decision.host_capabilities?.supports_skills_or_commands !== true) {
      fail(errors, `${path}.host_capabilities.supports_skills_or_commands`, "must be true for RUN_WITH_CONTRACT");
    }
    if (Array.isArray(decision.required_user_confirmation) && decision.required_user_confirmation.length > 0 && decision.host_capabilities?.has_approval_flow !== true) {
      fail(errors, `${path}.host_capabilities.has_approval_flow`, "must be true when user confirmation is required");
    }
    errors.push(...validateContract(decision.contract, decision.host_capabilities, `${path}.contract`));
  } else if (decision.contract !== null) {
    fail(errors, `${path}.contract`, "must be null unless decision is RUN_WITH_CONTRACT");
  }

  if (decision.host_capabilities?.capability_confidence === "unknown" && decision.decision === "RUN_WITH_CONTRACT") {
    fail(errors, `${path}.decision`, "unknown host capabilities cannot RUN_WITH_CONTRACT");
  }

  if (decision.decision === "NO_GO" && !decision.safe_alternative) {
    fail(errors, `${path}.safe_alternative`, "is required for NO_GO");
  }

  if (decision.decision === "PLAN_ONLY" && decision.plan_outputs.length === 0) {
    fail(errors, `${path}.plan_outputs`, "must contain at least one output for PLAN_ONLY");
  }

  return errors;
}

export function validateFixture(fixture, path = "fixture") {
  const errors = [];
  if (!isObject(fixture)) {
    fail(errors, path, "must be an object");
    return errors;
  }

  for (const key of ["id", "category", "user_goal", "repo_summary", "expected_decision"]) {
    if (!(key in fixture)) fail(errors, `${path}.${key}`, "is required");
  }

  if (typeof fixture.id !== "string" || fixture.id.length === 0) fail(errors, `${path}.id`, "must be a non-empty string");
  if (!DECISIONS.has(fixture.category)) fail(errors, `${path}.category`, "unsupported category");
  if (typeof fixture.user_goal !== "string" || fixture.user_goal.length === 0) {
    fail(errors, `${path}.user_goal`, "must be a non-empty string");
  }
  if (!isObject(fixture.repo_summary)) fail(errors, `${path}.repo_summary`, "must be an object");

  errors.push(...validateDecision(fixture.expected_decision, `${path}.expected_decision`));

  if (fixture.expected_decision?.decision && fixture.category !== fixture.expected_decision.decision) {
    fail(errors, `${path}.category`, "must match expected_decision.decision");
  }

  return errors;
}

export function validateFixtureSet(fixtures) {
  const errors = [];
  const ids = new Set();
  const counts = { NO_GO: 0, PLAN_ONLY: 0, RUN_WITH_CONTRACT: 0 };

  fixtures.forEach((fixture, index) => {
    const path = `fixtures[${index}]`;
    errors.push(...validateFixture(fixture, path));
    if (fixture.id) {
      if (ids.has(fixture.id)) fail(errors, `${path}.id`, `duplicate id ${fixture.id}`);
      ids.add(fixture.id);
    }
    if (counts[fixture.category] !== undefined) counts[fixture.category] += 1;
  });

  if (fixtures.length < 45) fail(errors, "fixtures", "must contain at least 45 fixtures");
  for (const decision of Object.keys(counts)) {
    if (counts[decision] < 15) fail(errors, `fixtures.${decision}`, "must contain at least 15 fixtures");
  }

  return { errors, counts, total: fixtures.length };
}
