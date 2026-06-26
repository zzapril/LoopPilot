#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cli = path.resolve("scripts/looppilot.mjs");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-save-"));
const source = path.join(tempDir, "source.md");
const reportOutput = path.join(tempDir, "latest-report.md");
const contractOutput = path.join(tempDir, "latest-contract.md");
const visionOutput = path.join(tempDir, "vision.md");
const stateOutput = path.join(tempDir, "state.md");
const runLogOutput = path.join(tempDir, "run-log.md");
const reviewGateOutput = path.join(tempDir, "latest-review-gate.md");
const errors = [];
fs.writeFileSync(source, "# Saved by explicit test\n", "utf8");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

for (const [command, output] of [
  ["save-report", reportOutput],
  ["save-contract", contractOutput],
  ["save-vision", visionOutput],
  ["save-state", stateOutput],
  ["save-run-log", runLogOutput],
  ["save-review-gate", reviewGateOutput],
]) {
  const missingFrom = run([command, "--output", output]);
  if (missingFrom.status === 0) errors.push(`${command} should require --from <path>`);

  const dryRunOutput = `${output}.dry-run`;
  const dryRun = run([command, "--from", source, "--output", dryRunOutput, "--dry-run"]);
  if (dryRun.status !== 0) errors.push(`${command} --dry-run failed: ${dryRun.stderr || dryRun.stdout}`);
  if (fs.existsSync(dryRunOutput)) errors.push(`${command} --dry-run wrote output`);

  const result = run([command, "--from", source, "--output", output]);
  if (result.status !== 0) errors.push(`${command} failed: ${result.stderr || result.stdout}`);
  if (!fs.existsSync(output)) errors.push(`${command} did not write requested output`);

  const duplicate = run([command, "--from", source, "--output", output]);
  if (duplicate.status === 0) errors.push(`${command} duplicate write should require --force`);

  const forced = run([command, "--from", source, "--output", output, "--force"]);
  if (forced.status !== 0) errors.push(`${command} --force failed: ${forced.stderr || forced.stdout}`);
}

fs.rmSync(tempDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot save command validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot save command validation passed.");
