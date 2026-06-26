#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

const cli = path.resolve("scripts/looppilot.mjs");
const errors = [];

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

for (const [args, expected] of [
  [["doctor", "--cwd"], "Missing value for --cwd."],
  [["install", "--target", "--dry-run"], "Missing value for --target."],
  [["export", "--target"], "Missing value for --target."],
  [["save-report", "--from"], "Missing value for --from."],
  [["doctor", "--unknown"], "Unknown argument: --unknown"],
]) {
  const result = run(args);
  const output = `${result.stderr}${result.stdout}`;
  if (result.status === 0) errors.push(`${args.join(" ")}: expected failure`);
  if (!output.includes(expected)) errors.push(`${args.join(" ")}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(output.trim())}`);
  if (output.includes("paths[0]") || output.includes("Received undefined")) {
    errors.push(`${args.join(" ")}: leaked low-level Node.js argument error`);
  }
}

if (errors.length > 0) {
  console.error("LoopPilot CLI argument validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot CLI argument validation passed.");
