#!/usr/bin/env node
import { readJsonFile, readJsonlFile } from "./lib/decision-validator.mjs";
import { validateDecisionAgainstSchema, validateDecisionSchemaDefinition, validateJsonSchema } from "./lib/schema-validator.mjs";

const schemaPath = ".looppilot/core/decision-schema.json";
const fixturePath = ".looppilot/fixtures/decision-fixtures.jsonl";

const schema = readJsonFile(schemaPath);
const fixtures = readJsonlFile(fixturePath);
const errors = validateDecisionSchemaDefinition(schema);

fixtures.forEach((fixture, index) => {
  errors.push(...validateDecisionAgainstSchema(fixture.expected_decision, schema, `fixtures[${index}].expected_decision`));
});

const negativeProbe = { ...fixtures.find((fixture) => fixture.expected_decision.decision === "RUN_WITH_CONTRACT").expected_decision };
delete negativeProbe.decision;
if (validateJsonSchema(negativeProbe, schema, "negativeProbe").length === 0) {
  errors.push("negativeProbe: missing required decision unexpectedly passed JSON Schema validation");
}

if (errors.length > 0) {
  console.error("LoopPilot schema validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("LoopPilot schema validation passed.");
console.log(`Fixtures checked: ${fixtures.length}`);
console.log("Runtime JSON Schema checks: enabled");
