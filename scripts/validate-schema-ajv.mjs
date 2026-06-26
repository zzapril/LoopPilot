#!/usr/bin/env node
import Ajv2020 from "ajv/dist/2020.js";
import { readJsonFile, readJsonlFile } from "./lib/decision-validator.mjs";

const schemaPath = ".looppilot/core/decision-schema.json";
const fixturePath = ".looppilot/fixtures/decision-fixtures.jsonl";

const schema = readJsonFile(schemaPath);
const fixtures = readJsonlFile(fixturePath);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
const errors = [];

function formatAjvErrors(ajvErrors = []) {
  return ajvErrors.map((error) => {
    const location = error.instancePath || "/";
    return `${location} ${error.message}`;
  });
}

function expectValid(value, label) {
  if (!validate(value)) {
    errors.push(`${label}: expected valid, got ${formatAjvErrors(validate.errors).join("; ")}`);
  }
}

function expectInvalid(value, label) {
  if (validate(value)) {
    errors.push(`${label}: expected invalid, got valid`);
  }
}

fixtures.forEach((fixture, index) => {
  expectValid(fixture.expected_decision, `fixtures[${index}].expected_decision`);
});

const runFixture = fixtures.find((fixture) => fixture.expected_decision.decision === "RUN_WITH_CONTRACT")?.expected_decision;
const noRunFixture = fixtures.find((fixture) => fixture.expected_decision.decision !== "RUN_WITH_CONTRACT")?.expected_decision;

if (!runFixture || !noRunFixture) {
  errors.push("fixtures: expected at least one RUN_WITH_CONTRACT fixture and one non-RUN_WITH_CONTRACT fixture");
} else {
  const missingRequired = structuredClone(runFixture);
  delete missingRequired.confidence;
  expectInvalid(missingRequired, "negative.missing_required_top_level_field");

  const invalidEnum = structuredClone(runFixture);
  invalidEnum.decision = "RUN_FOREVER";
  expectInvalid(invalidEnum, "negative.invalid_enum_value");

  const extraTopLevel = structuredClone(runFixture);
  extraTopLevel.unexpected = true;
  expectInvalid(extraTopLevel, "negative.extra_top_level_property");

  const nullContractForRun = structuredClone(runFixture);
  nullContractForRun.contract = null;
  expectInvalid(nullContractForRun, "negative.contract_null_for_run_with_contract");

  const malformedContractForRun = structuredClone(runFixture);
  malformedContractForRun.contract = { goal: "missing required contract fields" };
  expectInvalid(malformedContractForRun, "negative.malformed_contract_object_for_run_with_contract");

  const contractForNonRun = structuredClone(noRunFixture);
  contractForNonRun.contract = structuredClone(runFixture.contract);
  expectInvalid(contractForNonRun, "negative.contract_object_for_non_run_with_contract");
}

if (errors.length > 0) {
  console.error("LoopPilot Ajv schema validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot Ajv schema validation passed.");
console.log(`Fixtures checked: ${fixtures.length}`);
console.log("Draft: 2020-12");
console.log("Negative probes checked: 6");
