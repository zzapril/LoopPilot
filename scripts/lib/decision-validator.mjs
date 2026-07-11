import fs from "node:fs";

const DECISIONS = new Set(["NO_GO", "PLAN_ONLY", "RUN_WITH_CONTRACT"]);
const RECOMMENDED_SURFACES = new Set(["manual", "plan", "goal", "loop", "routine"]);
const RUN_WITH_CONTRACT_SURFACES = new Set(["goal", "loop", "routine"]);
const PLAN_ONLY_SURFACES = new Set(["plan", "loop", "routine"]);
const EXECUTABLE_SURFACES = new Set(["goal", "loop", "routine"]);
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
  "dependency_setup",
  "external_access",
  "large_diff",
  "config_change",
  "risky_path",
  "write_files",
  "run_commands",
  "save_files",
]);
const ALLOWED_ACTIONS = new Set([
  "read_files",
  "read_external_state",
  "read_external_source",
  "edit_small_scope",
  "run_test_command",
  "run_lint_command",
  "install_locked_dependencies",
  "create_report",
  "ask_user",
]);
const FORBIDDEN_ACTIONS = new Set([
  "edit_secrets",
  "change_auth_or_payment",
  "mutate_dependencies",
  "git_commit",
  "git_push",
  "deploy",
  "delete_files",
  "large_refactor",
  "mutate_external_state",
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

const HOST_CAPABILITY_KEYS = [
  "host",
  "can_edit_files",
  "can_run_commands",
  "has_approval_flow",
  "supports_skills_or_commands",
  "supported_surfaces",
  "capability_confidence",
];

const EXTERNAL_SURFACE_ACTIONS = new Set([
  "read_files",
  "read_external_state",
  "read_external_source",
  "create_report",
  "ask_user",
]);

const DIRECT_VERIFIER_EXECUTABLES = new Set([
  "eslint", "stylelint", "markdownlint", "markdownlint-cli2",
  "jest", "vitest", "pytest", "mypy", "pyright", "shellcheck",
]);
const SAFE_PACKAGE_SCRIPT = /^(?:test|test:[a-z0-9:_-]+|lint|lint:[a-z0-9:_-]+|typecheck|check|check:[a-z0-9:_-]+|verify|verify:[a-z0-9:_-]+|validate|validate:[a-z0-9:_-]+|format:check|docs:check)$/i;

function firstCommandArgument(tokens) {
  return tokens.find((token) => !token.startsWith("-"))?.toLowerCase() ?? "";
}

function packageVerifierReason(executable, tokens) {
  const subcommand = firstCommandArgument(tokens);
  if (!subcommand) return `${executable} gate must name a verifier script`;
  if (subcommand === "test") return null;

  if (["run", "run-script"].includes(subcommand)) {
    const runIndex = tokens.findIndex((token) => token.toLowerCase() === subcommand);
    const script = tokens.slice(runIndex + 1).find((token) => !token.startsWith("-"))?.toLowerCase() ?? "";
    return SAFE_PACKAGE_SCRIPT.test(script) ? null : `${executable} gate script ${script || "<missing>"} is not an allowlisted verifier`;
  }

  if (["pnpm", "yarn", "bun"].includes(executable) && SAFE_PACKAGE_SCRIPT.test(subcommand)) return null;
  return `${executable} ${subcommand} is not an allowlisted verifier command`;
}

function gitVerifierReason(tokens) {
  const normalized = tokens.map((token) => token.toLowerCase());
  const subcommand = firstCommandArgument(tokens);
  if (subcommand === "diff" && normalized.includes("--check")) return null;
  if (subcommand === "status" && normalized.some((token) => token === "--porcelain" || token.startsWith("--porcelain="))) return null;
  return `git ${subcommand || "<missing>"} is not an allowlisted verifier command`;
}

function toolchainVerifierReason(executable, tokens) {
  const subcommand = firstCommandArgument(tokens);
  const normalized = tokens.map((token) => token.toLowerCase());
  if (["eslint", "stylelint"].includes(executable) && normalized.includes("--fix")) {
    return `${executable} gate cannot use --fix`;
  }
  if (["jest", "vitest"].includes(executable)
    && normalized.some((token) => ["-u", "--updatesnapshot", "--watch", "--watchall"].includes(token))) {
    return `${executable} gate cannot update snapshots or watch indefinitely`;
  }
  if (DIRECT_VERIFIER_EXECUTABLES.has(executable)) return null;
  if (["tsc", "vue-tsc"].includes(executable)) {
    return normalized.some((token) => token === "--noemit") ? null : `${executable} gate must use --noEmit`;
  }
  if (executable === "prettier") {
    return normalized.some((token) => ["--check", "--list-different"].includes(token))
      && !normalized.some((token) => ["--write", "-w"].includes(token))
      ? null : "prettier gate must use --check or --list-different";
  }
  if (executable === "biome") {
    return ["check", "ci"].includes(subcommand) && !normalized.includes("--write")
      ? null : `biome ${subcommand} is not a read-only verifier command`;
  }
  if (executable === "ruff") {
    return ["check", "format"].includes(subcommand) && !normalized.includes("--fix")
      ? null : `ruff ${subcommand} is not a read-only verifier command`;
  }
  if (executable === "node") return tokens[0]?.toLowerCase() === "--check" ? null : "node gate must use --check";
  if (executable === "cargo") {
    if (["test", "check", "clippy"].includes(subcommand) && !normalized.includes("--fix")) return null;
    if (subcommand === "fmt" && tokens.some((token) => token === "--check")) return null;
    return `cargo ${subcommand} is not an allowlisted verifier command`;
  }
  if (executable === "go") return ["test", "vet"].includes(subcommand) ? null : `go ${subcommand} is not an allowlisted verifier command`;
  if (executable === "dotnet") return subcommand === "test" ? null : `dotnet ${subcommand} is not an allowlisted verifier command`;
  if (["mvn", "mvnw"].includes(executable)) return ["test", "verify"].includes(subcommand) ? null : `${executable} ${subcommand} is not an allowlisted verifier command`;
  if (["gradle", "gradlew"].includes(executable)) {
    const targets = tokens.filter((token) => !token.startsWith("-"));
    return targets.length > 0 && targets.every((token) => /^(?:test|check|lint)(?::[a-z0-9_-]+)*$/i.test(token))
      ? null : `${executable} gate must name a test, check, or lint task`;
  }
  if (["make", "just", "task"].includes(executable)) {
    const targets = tokens.filter((token) => !token.startsWith("-"));
    const overridesBuildFile = normalized.some((token) => ["-f", "--file", "--makefile"].includes(token));
    return !overridesBuildFile && targets.length > 0 && targets.every((token) => SAFE_PACKAGE_SCRIPT.test(token))
      ? null : `${executable} gate must name an allowlisted verifier target`;
  }
  return `executable ${executable || "<missing>"} is not an allowlisted local verifier`;
}

function commandReferencesSensitivePath(command) {
  return command.split(/\s+/).some((rawToken) => {
    const unquoted = rawToken.replace(/^["']+|["',]+$/g, "");
    const token = (unquoted.split("=").at(-1) ?? "").replaceAll("\\", "/").toLowerCase();
    const segments = token.split("/").filter(Boolean);
    const basename = segments.at(-1) ?? "";
    return /^\.env(?:\..*)?$/.test(basename)
      || [".npmrc", ".pypirc", ".netrc"].includes(basename)
      || /\.(?:pem|key)$/.test(basename)
      || segments.some((segment) => ["secrets", ".ssh", ".aws"].includes(segment))
      || token.endsWith(".docker/config.json")
      || token.endsWith(".config/gh/hosts.yml");
  });
}

function unsafeGateCommandReason(command) {
  if (commandReferencesSensitivePath(command)) {
    return "cannot read or validate sensitive paths";
  }
  if (/[\r\n;&|`<>]|\$\(/.test(command)) return "must be one simple verifier command without shell control operators";
  const tokens = command.trim().split(/\s+/);
  if (tokens[0]?.toLowerCase() === "env" || /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0] ?? "")) {
    return "cannot use environment wrappers or assignments in a gate command";
  }
  const mutatingFlag = tokens.map((token) => token.toLowerCase()).find(
    (token) => ["--fix", "--write", "-u", "--updatesnapshot", "--watch", "--watchall"].includes(token),
  );
  if (mutatingFlag) return `cannot use mutating or unbounded verifier flag ${mutatingFlag}`;
  const executable = (tokens.shift() ?? "").split(/[\\/]/).pop().toLowerCase();
  if (["npm", "pnpm", "yarn", "bun"].includes(executable)) return packageVerifierReason(executable, tokens);
  if (executable === "git") return gitVerifierReason(tokens);
  return toolchainVerifierReason(executable, tokens);
}

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
    if (typeof entry !== "string" || entry.trim().length === 0) {
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
    "supported_surfaces",
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
  validateStringArray(host.supported_surfaces, EXECUTABLE_SURFACES, `${path}.supported_surfaces`, errors);

  return errors;
}

function validateSurfaceConfig(config, path, errors) {
  if (!isObject(config)) {
    fail(errors, path, "must be an object");
    return;
  }

  if (!EXECUTABLE_SURFACES.has(config.type)) {
    fail(errors, `${path}.type`, "must be goal, loop, or routine");
    return;
  }

  if (config.type === "loop") {
    if (typeof config.source !== "string" || config.source.trim().length === 0) fail(errors, `${path}.source`, "must be a non-empty string");
    if (!Number.isInteger(config.interval_seconds) || config.interval_seconds < 30 || config.interval_seconds > 86400) {
      fail(errors, `${path}.interval_seconds`, "must be an integer from 30 to 86400");
    }
    validateStringArray(config.terminal_conditions, null, `${path}.terminal_conditions`, errors, { minItems: 1 });
  }

  if (config.type === "routine") {
    if (typeof config.source !== "string" || config.source.trim().length === 0) fail(errors, `${path}.source`, "must be a non-empty string");
    if (!isObject(config.cadence)) {
      fail(errors, `${path}.cadence`, "must be an object");
    } else {
      if (!["interval", "cron"].includes(config.cadence.type)) fail(errors, `${path}.cadence.type`, "must be interval or cron");
      for (const field of ["expression", "timezone"]) {
        if (typeof config.cadence[field] !== "string" || config.cadence[field].trim().length === 0) {
          fail(errors, `${path}.cadence.${field}`, "must be a non-empty string");
        }
      }
    }
    validateStringArray(config.access_scope, null, `${path}.access_scope`, errors, { minItems: 1 });
    if (typeof config.report_format !== "string" || config.report_format.trim().length === 0) {
      fail(errors, `${path}.report_format`, "must be a non-empty string");
    }
  }
}

function capabilityValuesEqual(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  }
  return a === b;
}

export function validateContract(contract, decisionHost, recommendedSurface, path = "contract") {
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
    "surface_config",
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

  if (typeof contract.goal !== "string" || contract.goal.trim().length === 0) {
    fail(errors, `${path}.goal`, "must be a non-empty string");
  }

  if (!isObject(contract.scope)) {
    fail(errors, `${path}.scope`, "must be an object");
  } else {
    validateStringArray(contract.scope.include, null, `${path}.scope.include`, errors, { minItems: 1 });
    validateStringArray(contract.scope.exclude, null, `${path}.scope.exclude`, errors);
  }

  validateStringArray(contract.allowed_actions, ALLOWED_ACTIONS, `${path}.allowed_actions`, errors, { minItems: 1 });
  validateStringArray(contract.forbidden_actions, FORBIDDEN_ACTIONS, `${path}.forbidden_actions`, errors, { minItems: 1 });

  for (const requiredForbidden of ["edit_secrets", "mutate_dependencies", "git_commit", "git_push", "deploy"]) {
    if (!contract.forbidden_actions?.includes(requiredForbidden)) {
      fail(errors, `${path}.forbidden_actions`, `must include ${requiredForbidden}`);
    }
  }

  validateSurfaceConfig(contract.surface_config, `${path}.surface_config`, errors);
  if (contract.surface_config?.type !== recommendedSurface) {
    fail(errors, `${path}.surface_config.type`, "must match recommended_surface");
  }

  if (["loop", "routine"].includes(contract.surface_config?.type)) {
    for (const action of contract.allowed_actions ?? []) {
      if (!EXTERNAL_SURFACE_ACTIONS.has(action)) {
        fail(errors, `${path}.allowed_actions`, `${contract.surface_config.type} contracts cannot allow ${action}`);
      }
    }
    if (!contract.forbidden_actions?.includes("mutate_external_state")) {
      fail(errors, `${path}.forbidden_actions`, "external surface contracts must include mutate_external_state");
    }
    if (!contract.human_confirmations?.includes("external_access")) {
      fail(errors, `${path}.human_confirmations`, "external surface contracts must include external_access");
    }
  }
  if (contract.surface_config?.type === "loop" && !contract.allowed_actions?.includes("read_external_state")) {
    fail(errors, `${path}.allowed_actions`, "loop contracts must include read_external_state");
  }
  if (contract.surface_config?.type === "routine" && !contract.allowed_actions?.includes("read_external_source")) {
    fail(errors, `${path}.allowed_actions`, "routine contracts must include read_external_source");
  }

  if (!isObject(contract.gate)) {
    fail(errors, `${path}.gate`, "must be an object");
  } else {
    if (!GATE_TYPES.has(contract.gate.type)) fail(errors, `${path}.gate.type`, "unsupported gate type");
    if (!(typeof contract.gate.command === "string" || contract.gate.command === null)) {
      fail(errors, `${path}.gate.command`, "must be string or null");
    }
    if (typeof contract.gate.expect !== "string" || contract.gate.expect.trim().length === 0) {
      fail(errors, `${path}.gate.expect`, "must be a non-empty string");
    }
    if (contract.gate.type === "command") {
      if (typeof contract.gate.command !== "string" || contract.gate.command.trim().length === 0) {
        fail(errors, `${path}.gate.command`, "must be a non-empty string for a command gate");
      } else {
        const unsafeReason = unsafeGateCommandReason(contract.gate.command);
        if (unsafeReason) fail(errors, `${path}.gate.command`, unsafeReason);
      }
    } else if (contract.gate.command !== null) {
      fail(errors, `${path}.gate.command`, "must be null unless gate type is command");
    }
  }

  validateStringArray(contract.stop_conditions, STOP_CONDITIONS, `${path}.stop_conditions`, errors, { minItems: 2 });
  for (const requiredStop of ["gate_passes", "max_rounds_reached", "forbidden_action_needed", "user_interrupt"]) {
    if (!contract.stop_conditions?.includes(requiredStop)) {
      fail(errors, `${path}.stop_conditions`, `must include ${requiredStop}`);
    }
  }

  const maxRoundsBySurface = { goal: 10, loop: 100, routine: 365 };
  const maxRounds = maxRoundsBySurface[contract.surface_config?.type] ?? 10;
  if (!Number.isInteger(contract.max_rounds) || contract.max_rounds < 1 || contract.max_rounds > maxRounds) {
    fail(errors, `${path}.max_rounds`, `must be an integer from 1 to ${maxRounds}`);
  }

  errors.push(...validateHostCapabilities(contract.host_capabilities, `${path}.host_capabilities`));
  if (decisionHost && isObject(contract.host_capabilities)) {
    for (const key of HOST_CAPABILITY_KEYS) {
      if (!capabilityValuesEqual(contract.host_capabilities[key], decisionHost[key])) {
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
  if (!contract.host_capabilities?.supported_surfaces?.includes(contract.surface_config?.type)) {
    fail(errors, `${path}.host_capabilities.supported_surfaces`, "must include the contract surface");
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
  if (!RECOMMENDED_SURFACES.has(decision.recommended_surface)) {
    fail(errors, `${path}.recommended_surface`, "unsupported recommended surface");
  }
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
  if (decision.needs_clarification && typeof decision.clarifying_question === "string" && decision.clarifying_question.trim().length === 0) {
    fail(errors, `${path}.clarifying_question`, "must be a non-empty string when clarification is needed");
  }
  if (!decision.needs_clarification && decision.clarifying_question !== null) {
    fail(errors, `${path}.clarifying_question`, "must be null when clarification is not needed");
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
    if (!RUN_WITH_CONTRACT_SURFACES.has(decision.recommended_surface)) {
      fail(errors, `${path}.recommended_surface`, "must be goal, loop, or routine for RUN_WITH_CONTRACT");
    }
    if (decision.needs_clarification) {
      fail(errors, `${path}.needs_clarification`, "must be false for RUN_WITH_CONTRACT");
    }
    if (decision.safe_alternative !== null) fail(errors, `${path}.safe_alternative`, "must be null for RUN_WITH_CONTRACT");
    if (decision.next_prompt !== null) fail(errors, `${path}.next_prompt`, "must be null for RUN_WITH_CONTRACT");
    if (decision.plan_outputs?.length !== 0) fail(errors, `${path}.plan_outputs`, "must be empty for RUN_WITH_CONTRACT");
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
    if (!decision.host_capabilities?.supported_surfaces?.includes(decision.recommended_surface)) {
      fail(errors, `${path}.host_capabilities.supported_surfaces`, "must include recommended_surface for RUN_WITH_CONTRACT");
    }
    errors.push(...validateContract(decision.contract, decision.host_capabilities, decision.recommended_surface, `${path}.contract`));
    for (const confirmation of decision.required_user_confirmation ?? []) {
      if (!decision.contract?.human_confirmations?.includes(confirmation)) {
        fail(errors, `${path}.contract.human_confirmations`, `must include required confirmation ${confirmation}`);
      }
    }
    const readsExternalState = decision.contract?.allowed_actions?.some(
      (action) => action === "read_external_state" || action === "read_external_source",
    );
    if (readsExternalState) {
      if (!decision.required_user_confirmation?.includes("external_access")) {
        fail(errors, `${path}.required_user_confirmation`, "must include external_access when external reads are allowed");
      }
      if (!decision.contract?.human_confirmations?.includes("external_access")) {
        fail(errors, `${path}.contract.human_confirmations`, "must include external_access when external reads are allowed");
      }
    } else {
      if (decision.required_user_confirmation?.includes("external_access")) {
        fail(errors, `${path}.required_user_confirmation`, "cannot require external_access when external reads are not allowed");
      }
      if (decision.contract?.human_confirmations?.includes("external_access")) {
        fail(errors, `${path}.contract.human_confirmations`, "cannot include external_access when external reads are not allowed");
      }
    }
    if (decision.contract?.allowed_actions?.includes("install_locked_dependencies")) {
      if (!decision.required_user_confirmation?.includes("dependency_setup")) {
        fail(errors, `${path}.required_user_confirmation`, "must include dependency_setup when locked dependency setup is allowed");
      }
      if (!decision.contract?.human_confirmations?.includes("dependency_setup")) {
        fail(errors, `${path}.contract.human_confirmations`, "must include dependency_setup when locked dependency setup is allowed");
      }
    } else {
      if (decision.required_user_confirmation?.includes("dependency_setup")) {
        fail(errors, `${path}.required_user_confirmation`, "cannot require dependency_setup when locked dependency setup is not allowed");
      }
      if (decision.contract?.human_confirmations?.includes("dependency_setup")) {
        fail(errors, `${path}.contract.human_confirmations`, "cannot include dependency_setup when locked dependency setup is not allowed");
      }
    }
  } else if (decision.contract !== null) {
    fail(errors, `${path}.contract`, "must be null unless decision is RUN_WITH_CONTRACT");
  }

  if (decision.decision === "NO_GO" && decision.recommended_surface !== "manual") {
    fail(errors, `${path}.recommended_surface`, "must be manual for NO_GO");
  }

  if (decision.decision === "PLAN_ONLY" && !PLAN_ONLY_SURFACES.has(decision.recommended_surface)) {
    fail(errors, `${path}.recommended_surface`, "must be plan, loop, or routine for PLAN_ONLY");
  }

  if (decision.host_capabilities?.capability_confidence === "unknown" && decision.decision === "RUN_WITH_CONTRACT") {
    fail(errors, `${path}.decision`, "unknown host capabilities cannot RUN_WITH_CONTRACT");
  }

  if (decision.decision === "NO_GO"
    && (typeof decision.safe_alternative !== "string" || decision.safe_alternative.trim().length === 0)) {
    fail(errors, `${path}.safe_alternative`, "is required for NO_GO");
  }

  if (decision.decision === "NO_GO") {
    if (decision.needs_clarification) fail(errors, `${path}.needs_clarification`, "must be false for NO_GO");
    if (typeof decision.next_prompt !== "string" || decision.next_prompt.trim().length === 0) {
      fail(errors, `${path}.next_prompt`, "must be a non-empty string for NO_GO");
    }
    if (decision.plan_outputs?.length !== 0) fail(errors, `${path}.plan_outputs`, "must be empty for NO_GO");
    if (decision.required_user_confirmation?.length !== 0) {
      fail(errors, `${path}.required_user_confirmation`, "must be empty for NO_GO");
    }
  }

  if (decision.decision === "PLAN_ONLY" && decision.plan_outputs.length === 0) {
    fail(errors, `${path}.plan_outputs`, "must contain at least one output for PLAN_ONLY");
  }
  if (decision.decision === "PLAN_ONLY") {
    if (decision.safe_alternative !== null) fail(errors, `${path}.safe_alternative`, "must be null for PLAN_ONLY");
    if (typeof decision.next_prompt !== "string" || decision.next_prompt.trim().length === 0) {
      fail(errors, `${path}.next_prompt`, "must be a non-empty string for PLAN_ONLY");
    }
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
