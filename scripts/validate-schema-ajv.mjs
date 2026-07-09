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
      label: "safety.run_with_contract_surface_must_be_executable",
      mutate(decision) {
        decision.recommended_surface = "manual";
      },
    },
  ];

  safetyNegativeCases.forEach((negativeCase) => {
    safetyNegativeProbeCount += 1;
    const decision = clone(runDecision);
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
