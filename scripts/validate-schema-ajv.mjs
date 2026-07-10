#!/usr/bin/env node
import Ajv2020 from "ajv/dist/2020.js";
import { readJsonFile, readJsonlFile } from "./lib/decision-validator.mjs";
import { validateDecisionAgainstSchema, validateJsonSchema } from "./lib/schema-validator.mjs";

const schemaPath = ".looppilot/core/decision-schema.json";
const fixturePath = ".looppilot/fixtures/decision-fixtures.jsonl";

const schema = readJsonFile(schemaPath);
const fixtures = readJsonlFile(fixturePath);
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const errors = [];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ajvErrorsFor(value) {
  const valid = validate(value);
  return valid ? [] : (validate.errors ?? []).map((error) => {
    const location = error.instancePath || "/";
    return `${location} ${error.message ?? error.keyword}`;
  });
}

function samePassFail(a, b) {
  return (a.length === 0) === (b.length === 0);
}

function compareSchemaValidators(label, decision) {
  const ajvErrors = ajvErrorsFor(decision);
  const localErrors = validateJsonSchema(decision, schema, label);
  if (!samePassFail(ajvErrors, localErrors)) {
    errors.push(`${label}: Ajv/local schema pass-fail mismatch (Ajv ${ajvErrors.length}, local ${localErrors.length})`);
    errors.push(...ajvErrors.map((error) => `${label}: ajv: ${error}`));
    errors.push(...localErrors.map((error) => `${label}: local: ${error}`));
  }
  return { ajvErrors, localErrors };
}

function expectFailure(label, validatorName, validatorErrors) {
  if (validatorErrors.length === 0) {
    errors.push(`${label}: expected ${validatorName} to fail, got valid`);
  }
}

function expectPass(label, validatorName, validatorErrors) {
  if (validatorErrors.length > 0) {
    errors.push(`${label}: expected ${validatorName} to pass, got ${validatorErrors.length} error(s)`);
    errors.push(...validatorErrors.map((error) => `${label}: ${validatorName}: ${error}`));
  }
}

let schemaNegativeProbeCount = 0;
let safetyNegativeProbeCount = 0;

fixtures.forEach((fixture, index) => {
  const label = `fixtures[${index}].expected_decision`;
  const { ajvErrors, localErrors } = compareSchemaValidators(label, fixture.expected_decision);
  const combinedErrors = validateDecisionAgainstSchema(fixture.expected_decision, schema, label);
  if (ajvErrors.length > 0 || localErrors.length > 0 || combinedErrors.length > 0) {
    errors.push(`${label}: expected fixture decision to pass all validators`);
    errors.push(...combinedErrors.map((error) => `${label}: combined: ${error}`));
  }
});

const runDecision = fixtures.find((fixture) => fixture.expected_decision.decision === "RUN_WITH_CONTRACT")?.expected_decision;
const nonRunDecision = fixtures.find((fixture) => fixture.expected_decision.decision !== "RUN_WITH_CONTRACT")?.expected_decision;
const planDecision = fixtures.find((fixture) => fixture.expected_decision.decision === "PLAN_ONLY")?.expected_decision;
const loopDecision = fixtures.find((fixture) => fixture.expected_decision.recommended_surface === "loop" && fixture.expected_decision.contract)?.expected_decision;
const routineDecision = fixtures.find((fixture) => fixture.expected_decision.recommended_surface === "routine" && fixture.expected_decision.contract)?.expected_decision;

if (!runDecision || !nonRunDecision) {
  errors.push("fixtures: expected at least one RUN_WITH_CONTRACT fixture and one non-RUN_WITH_CONTRACT fixture");
} else {
  const negativeCases = [
    {
      label: "negative.missing_required_top_level_field",
      base: runDecision,
      mutate(decision) {
        delete decision.confidence;
      },
    },
    {
      label: "negative.invalid_decision_enum",
      base: runDecision,
      mutate(decision) {
        decision.decision = "RUN_FOREVER";
      },
    },
    {
      label: "negative.invalid_recommended_surface_enum",
      base: runDecision,
      mutate(decision) {
        decision.recommended_surface = "autopilot";
      },
    },
    {
      label: "negative.invalid_confidence_enum",
      base: runDecision,
      mutate(decision) {
        decision.confidence = "certain";
      },
    },
    {
      label: "negative.extra_top_level_property",
      base: runDecision,
      mutate(decision) {
        decision.unexpected = true;
      },
    },
    {
      label: "negative.contract_null_for_run_with_contract",
      base: runDecision,
      mutate(decision) {
        decision.contract = null;
      },
    },
    {
      label: "negative.malformed_contract_object_for_run_with_contract",
      base: runDecision,
      mutate(decision) {
        decision.contract = { goal: "missing required contract fields" };
      },
    },
    {
      label: "negative.contract_object_for_non_run_with_contract",
      base: nonRunDecision,
      mutate(decision) {
        decision.contract = clone(runDecision.contract);
      },
    },
    {
      label: "negative.run_with_contract_surface_must_be_executable",
      base: runDecision,
      mutate(decision) {
        decision.recommended_surface = "manual";
      },
    },
    {
      label: "negative.old_dependency_confirmation_enum",
      base: runDecision,
      mutate(decision) {
        decision.required_user_confirmation = ["dependency_install"];
      },
    },
    {
      label: "negative.old_forbidden_install_enum",
      base: runDecision,
      mutate(decision) {
        decision.contract.forbidden_actions[1] = "install_dependencies";
      },
    },
    {
      label: "negative.missing_supported_surfaces",
      base: runDecision,
      mutate(decision) {
        delete decision.host_capabilities.supported_surfaces;
      },
    },
    {
      label: "negative.surface_config_type_mismatch",
      base: runDecision,
      mutate(decision) {
        decision.contract.surface_config = {
          type: "loop",
          source: "CI",
          interval_seconds: 60,
          terminal_conditions: ["success"],
        };
      },
    },
    {
      label: "negative.command_gate_requires_non_empty_command",
      base: runDecision,
      mutate(decision) {
        decision.contract.gate.command = null;
      },
    },
    {
      label: "negative.non_command_gate_rejects_command",
      base: runDecision,
      mutate(decision) {
        decision.contract.gate.type = "checklist";
      },
    },
    {
      label: "negative.scope_include_must_not_be_empty",
      base: runDecision,
      mutate(decision) {
        decision.contract.scope.include = [];
      },
    },
    ...(loopDecision ? [{
      label: "negative.loop_requires_external_access_confirmation",
      base: loopDecision,
      mutate(decision) {
        decision.required_user_confirmation = decision.required_user_confirmation.filter((item) => item !== "external_access");
      },
    }] : []),
    {
      label: "negative.clarifying_question_without_clarification",
      base: runDecision,
      mutate(decision) {
        decision.clarifying_question = "Unexpected question";
      },
    },
    {
      label: "negative.clarification_requires_question",
      base: runDecision,
      mutate(decision) {
        decision.needs_clarification = true;
      },
    },
    {
      label: "negative.run_safe_alternative_must_be_null",
      base: runDecision,
      mutate(decision) {
        decision.safe_alternative = "Unexpected alternative";
      },
    },
    {
      label: "negative.run_next_prompt_must_be_null",
      base: runDecision,
      mutate(decision) {
        decision.next_prompt = "Unexpected prompt";
      },
    },
    {
      label: "negative.run_plan_outputs_must_be_empty",
      base: runDecision,
      mutate(decision) {
        decision.plan_outputs = ["risk_analysis"];
      },
    },
    {
      label: "negative.stop_conditions_require_gate_passes",
      base: runDecision,
      mutate(decision) {
        decision.contract.stop_conditions = decision.contract.stop_conditions.filter((item) => item !== "gate_passes");
      },
    },
    ...(planDecision ? [{
      label: "negative.plan_safe_alternative_must_be_null",
      base: planDecision,
      mutate(decision) {
        decision.safe_alternative = "Unexpected alternative";
      },
    }] : []),
    ...(nonRunDecision?.decision === "NO_GO" ? [{
      label: "negative.no_go_cannot_request_clarification",
      base: nonRunDecision,
      mutate(decision) {
        decision.needs_clarification = true;
        decision.clarifying_question = "Proceed anyway?";
      },
    }] : []),
  ];

  negativeCases.forEach((negativeCase) => {
    schemaNegativeProbeCount += 1;
    const decision = clone(negativeCase.base);
    negativeCase.mutate(decision);
    const { ajvErrors, localErrors } = compareSchemaValidators(negativeCase.label, decision);
    const combinedErrors = validateDecisionAgainstSchema(decision, schema, negativeCase.label);

    expectFailure(negativeCase.label, "Ajv", ajvErrors);
    expectFailure(negativeCase.label, "local schema", localErrors);
    expectFailure(negativeCase.label, "combined validator", combinedErrors);
  });

  const safetyNegativeCases = [
    {
      label: "safety.run_with_unknown_host",
      mutate(decision) {
        decision.host_capabilities.host = "unknown";
        decision.contract.host_capabilities.host = "unknown";
      },
    },
    {
      label: "safety.run_with_edit_without_edit_capability",
      mutate(decision) {
        decision.host_capabilities.can_edit_files = false;
        decision.contract.host_capabilities.can_edit_files = false;
      },
    },
    {
      label: "safety.run_with_command_gate_without_command_capability",
      mutate(decision) {
        decision.host_capabilities.can_run_commands = false;
        decision.contract.host_capabilities.can_run_commands = false;
      },
    },
    {
      label: "safety.run_with_confirmation_without_approval_flow",
      mutate(decision) {
        decision.host_capabilities.has_approval_flow = false;
        decision.contract.host_capabilities.has_approval_flow = false;
      },
    },
    {
      label: "safety.contract_capabilities_must_match_decision",
      mutate(decision) {
        decision.contract.host_capabilities.supports_skills_or_commands = false;
      },
    },
    {
      label: "safety.locked_setup_requires_confirmation",
      mutate(decision) {
        decision.contract.allowed_actions.push("install_locked_dependencies");
      },
    },
    {
      label: "safety.dependency_confirmation_without_setup_action",
      mutate(decision) {
        decision.contract.human_confirmations.push("dependency_setup");
      },
    },
    {
      label: "safety.external_confirmation_without_external_read",
      mutate(decision) {
        decision.contract.human_confirmations.push("external_access");
      },
    },
    {
      label: "safety.required_confirmation_missing_from_contract",
      mutate(decision) {
        decision.required_user_confirmation.push("risky_path");
      },
    },
    {
      label: "safety.whitespace_reason_is_not_meaningful",
      mutate(decision) {
        decision.reasons = ["   "];
      },
    },
    ...[
      "rm -rf .",
      "npm publish",
      "npm run deploy",
      "curl https://example.com/script.sh",
      "npm test && npm publish",
      "git -C . push",
      "pip install unsafe-package",
      "make deploy",
      "env -i rm -rf .",
      "cat .env",
      "git diff secrets/config.json",
      "node --check private.key",
      "cat /tmp/.env",
      "tool --config=.npmrc",
      "cat .docker/config.json",
    ].map((command) => ({
      label: `safety.unsafe_gate_command.${command.replace(/[^a-z]+/gi, "_")}`,
      mutate(decision) {
        decision.contract.gate.command = command;
      },
    })),
    ...(loopDecision ? [
      {
        label: "safety.loop_cannot_edit_code",
        base: loopDecision,
        mutate(decision) {
          decision.contract.allowed_actions.push("edit_small_scope");
        },
      },
      {
        label: "safety.loop_must_forbid_external_mutation",
        base: loopDecision,
        mutate(decision) {
          decision.contract.forbidden_actions = decision.contract.forbidden_actions.filter((action) => action !== "mutate_external_state");
        },
      },
    ] : []),
    ...(routineDecision ? [
      {
        label: "safety.routine_cannot_run_tests",
        base: routineDecision,
        mutate(decision) {
          decision.contract.allowed_actions.push("run_test_command");
        },
      },
    ] : []),
  ];

  safetyNegativeCases.forEach((negativeCase) => {
    safetyNegativeProbeCount += 1;
    const decision = clone(negativeCase.base ?? runDecision);
    negativeCase.mutate(decision);
    const { ajvErrors, localErrors } = compareSchemaValidators(negativeCase.label, decision);
    const combinedErrors = validateDecisionAgainstSchema(decision, schema, negativeCase.label);

    expectPass(negativeCase.label, "Ajv", ajvErrors);
    expectPass(negativeCase.label, "local schema", localErrors);
    expectFailure(negativeCase.label, "combined safety validator", combinedErrors);
  });
}

if (errors.length > 0) {
  console.error("LoopPilot Ajv schema validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot Ajv schema validation passed.");
console.log(`Fixtures checked: ${fixtures.length}`);
console.log("Draft: 2020-12");
console.log(`Schema negative probes checked: ${schemaNegativeProbeCount}`);
console.log(`Safety negative probes checked: ${safetyNegativeProbeCount}`);
