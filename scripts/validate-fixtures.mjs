#!/usr/bin/env node
import { readJsonFile, readJsonlFile, validateFixtureSet } from "./lib/decision-validator.mjs";

const schemaPath = ".looppilot/core/decision-schema.json";
const fixturePath = ".looppilot/fixtures/decision-fixtures.jsonl";

readJsonFile(schemaPath);
const fixtures = readJsonlFile(fixturePath);
const result = validateFixtureSet(fixtures);

if (result.errors.length > 0) {
  console.error("LoopPilot fixture validation failed:");
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("LoopPilot fixture validation passed.");
console.log(`Fixtures: ${result.total}`);
console.log(`NO_GO: ${result.counts.NO_GO}`);
console.log(`PLAN_ONLY: ${result.counts.PLAN_ONLY}`);
console.log(`RUN_WITH_CONTRACT: ${result.counts.RUN_WITH_CONTRACT}`);
