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
    const decision = clone(negativeCase.base);
    negativeCase.mutate(decision);
    const { ajvErrors, localErrors } = compareSchemaValidators(negativeCase.label, decision);
    const combinedErrors = validateDecisionAgainstSchema(decision, schema, negativeCase.label);

    expectFailure(negativeCase.label, "Ajv", ajvErrors);
    expectFailure(negativeCase.label, "local schema", localErrors);
    expectFailure(negativeCase.label, "combined validator", combinedErrors);
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
console.log("Negative probes checked: 7");
