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

fixtures.forEach((fixture, index) => {
  const label = `fixtures[${index}].expected_decision`;
  const { ajvErrors, localErrors } = compareSchemaValidators(label, fixture.expected_decision);
  const combinedErrors = validateDecisionAgainstSchema(fixture.expected_decision, schema, label);
  if (ajvErrors.length > 0 || localErrors.length > 0 || combinedErrors.length > 0) {
    errors.push(`${label}: expected fixture decision to pass all validators`);
    errors.push(...combinedErrors.map((error) => `${label}: combined: ${error}`));
  }
});

const validRunDecision = fixtures.find((fixture) => fixture.expected_decision.decision === "RUN_WITH_CONTRACT")?.expected_decision;
if (!validRunDecision) {
  errors.push("fixtures: no RUN_WITH_CONTRACT fixture is available for negative cases");
} else {
  const negativeCases = [
    {
      label: "negative.missing_required_decision",
      mutate(decision) {
        delete decision.decision;
      },
      expectAjvFailure: true,
      expectLocalSchemaFailure: true,
      expectCombinedFailure: true,
    },
    {
      label: "negative.extra_property",
      mutate(decision) {
        decision.unexpected_property = true;
      },
      expectAjvFailure: true,
      expectLocalSchemaFailure: true,
      expectCombinedFailure: true,
    },
    {
      label: "negative.invalid_enum_value",
      mutate(decision) {
        decision.confidence = "certain";
      },
      expectAjvFailure: true,
      expectLocalSchemaFailure: true,
      expectCombinedFailure: true,
    },
    {
      label: "negative.run_contract_null",
      mutate(decision) {
        decision.contract = null;
      },
      expectAjvFailure: false,
      expectLocalSchemaFailure: false,
      expectCombinedFailure: true,
    },
  ];

  negativeCases.forEach((negativeCase) => {
    const decision = clone(validRunDecision);
    negativeCase.mutate(decision);
    const { ajvErrors, localErrors } = compareSchemaValidators(negativeCase.label, decision);
    const combinedErrors = validateDecisionAgainstSchema(decision, schema, negativeCase.label);

    if ((ajvErrors.length > 0) !== negativeCase.expectAjvFailure) {
      errors.push(`${negativeCase.label}: Ajv failure expectation mismatch (${ajvErrors.length} errors)`);
    }
    if ((localErrors.length > 0) !== negativeCase.expectLocalSchemaFailure) {
      errors.push(`${negativeCase.label}: local schema failure expectation mismatch (${localErrors.length} errors)`);
    }
    if ((combinedErrors.length > 0) !== negativeCase.expectCombinedFailure) {
      errors.push(`${negativeCase.label}: combined validator failure expectation mismatch (${combinedErrors.length} errors)`);
    }
  });
}

if (errors.length > 0) {
  console.error("LoopPilot Ajv schema validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot Ajv schema validation passed.");
console.log(`Fixtures checked: ${fixtures.length}`);
console.log("Negative cases checked: missing required fields, extra properties, invalid enum values, RUN_WITH_CONTRACT contract null");
console.log("npm test integration: omitted; run this check explicitly with npm run validate:schema-ajv after dev dependencies are installed.");
