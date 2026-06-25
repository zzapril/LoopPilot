#!/usr/bin/env node
import { validateWrappers } from "./lib/wrapper-validator.mjs";

const result = validateWrappers();

if (result.errors.length > 0) {
  console.error("LoopPilot wrapper validation failed:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot wrapper validation passed.");
console.log(`Wrappers: ${result.wrappers}`);
console.log(`Claude command alias: ${result.hasClaudeCommandAlias ? "present" : "missing"}`);
