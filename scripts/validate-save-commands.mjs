#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { saveExplicitFile } from "./lib/cli.mjs";

const cli = path.resolve("scripts/looppilot.mjs");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-save-"));
const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-save-outside-"));
const source = path.join(tempDir, "source.md");
const reportOutput = path.join(tempDir, "latest-report.md");
const contractOutput = path.join(tempDir, "latest-contract.md");
const visionOutput = path.join(tempDir, "VISION.md");
const stateOutput = path.join(tempDir, "STATE.md");
const runLogOutput = path.join(tempDir, "RUN_LOG.md");
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

for (const [command, expectedDefault] of [
  ["save-vision", path.join(tempDir, ".looppilot", "VISION.md")],
  ["save-state", path.join(tempDir, ".looppilot", "STATE.md")],
  ["save-run-log", path.join(tempDir, ".looppilot", "RUN_LOG.md")],
  ["save-review-gate", path.join(tempDir, ".looppilot", "latest-review-gate.md")],
]) {
  const result = run([command, "--cwd", tempDir, "--from", source]);
  if (result.status !== 0) errors.push(`${command} default output failed: ${result.stderr || result.stdout}`);
  if (!fs.existsSync(expectedDefault)) errors.push(`${command} did not write default output ${path.relative(tempDir, expectedDefault)}`);
}

const linkedOutputDir = path.join(tempDir, "linked-output");
fs.symlinkSync(outsideDir, linkedOutputDir, process.platform === "win32" ? "junction" : "dir");
const linkedSave = run(["save-report", "--cwd", tempDir, "--from", source, "--output", path.join("linked-output", "report.md")]);
if (linkedSave.status === 0) errors.push("save-report through a symlinked output directory unexpectedly succeeded");
if (!`${linkedSave.stderr}${linkedSave.stdout}`.includes("symbolic link path component")) {
  errors.push("save-report symlink failure returned the wrong error");
}
if (fs.existsSync(path.join(outsideDir, "report.md"))) errors.push("save-report escaped the project through a symlink");

const protectedSave = run(["save-report", "--cwd", tempDir, "--from", source, "--output", ".looppilot/core/report.md", "--force"]);
if (protectedSave.status === 0) errors.push("save-report unexpectedly wrote into the Agent Pack core");
if (!`${protectedSave.stderr}${protectedSave.stdout}`.includes("refuses to overwrite Agent Pack file")) {
  errors.push("save-report protected-path failure returned the wrong error");
}

const nestedPackageDir = path.join(tempDir, "nested-package");
fs.mkdirSync(nestedPackageDir);
const nestedPackageJson = path.join(nestedPackageDir, "package.json");
fs.writeFileSync(nestedPackageJson, "ORIGINAL", "utf8");
const dependencySave = run(["save-report", "--cwd", tempDir, "--from", source, "--output", "nested-package/package.json", "--force"]);
if (dependencySave.status === 0) errors.push("save-report unexpectedly overwrote dependency metadata");
if (!`${dependencySave.stderr}${dependencySave.stdout}`.includes("refuses to overwrite dependency metadata")) {
  errors.push("save-report dependency metadata protection returned the wrong error");
}
if (fs.readFileSync(nestedPackageJson, "utf8") !== "ORIGINAL") errors.push("save-report changed a nested package.json");

const syntheticEnv = path.join(tempDir, ".env");
fs.writeFileSync(syntheticEnv, "SYNTHETIC_TEST_VALUE", "utf8");
const sensitiveSourceSave = run(["save-report", "--cwd", tempDir, "--from", ".env", "--output", "copied-env.md"]);
if (sensitiveSourceSave.status === 0) errors.push("save-report unexpectedly accepted a sensitive source path");
if (!`${sensitiveSourceSave.stderr}${sensitiveSourceSave.stdout}`.includes("refuses to read a sensitive source path")) {
  errors.push("save-report sensitive source returned the wrong error");
}
if (fs.existsSync(path.join(tempDir, "copied-env.md"))) errors.push("save-report copied a sensitive source");

const sensitiveOutputSave = run(["save-report", "--cwd", tempDir, "--from", source, "--output", ".env.report"]);
if (sensitiveOutputSave.status === 0) errors.push("save-report unexpectedly wrote to a sensitive output path");
if (!`${sensitiveOutputSave.stderr}${sensitiveOutputSave.stdout}`.includes("refuses to write a sensitive path")) {
  errors.push("save-report sensitive output returned the wrong error");
}

if (process.platform !== "win32") {
  const sourceLink = path.join(tempDir, "source-link.md");
  fs.symlinkSync(source, sourceLink, "file");
  const linkedSourceSave = run(["save-report", "--cwd", tempDir, "--from", sourceLink, "--output", "linked-source-report.md"]);
  if (linkedSourceSave.status === 0) errors.push("save-report unexpectedly followed a symbolic-link source");
  if (!`${linkedSourceSave.stderr}${linkedSourceSave.stdout}`.includes("symbolic link path component")) {
    errors.push("save-report symbolic-link source returned the wrong error");
  }
}

const atomicSource = path.join(tempDir, "atomic-source.md");
const atomicOutput = path.join(tempDir, "atomic-output.md");
fs.writeFileSync(atomicSource, "NEW", "utf8");
fs.writeFileSync(atomicOutput, "ORIGINAL", "utf8");
const originalRenameSync = fs.renameSync;
let replacementAttempts = 0;
try {
  fs.renameSync = (from, to) => {
    if (to === atomicOutput && from.includes(".tmp")) {
      replacementAttempts += 1;
      const error = new Error(replacementAttempts === 1 ? "simulated replace-not-supported" : "simulated replacement failure");
      error.code = replacementAttempts === 1 ? "EEXIST" : "EIO";
      throw error;
    }
    if (to === atomicOutput && from.includes(".old")) {
      const error = new Error("simulated restoration failure");
      error.code = "EIO";
      throw error;
    }
    return originalRenameSync(from, to);
  };
  try {
    saveExplicitFile({ cwd: tempDir, from: atomicSource, output: atomicOutput, force: true, dryRun: false }, "report");
    errors.push("atomic save unexpectedly succeeded when replacement and restoration were forced to fail");
  } catch (error) {
    if (!error.message.includes("original file was preserved at")) {
      errors.push(`atomic save failure did not report preserved original: ${error.message}`);
    }
  }
} finally {
  fs.renameSync = originalRenameSync;
}
const displacedOriginal = fs.readdirSync(tempDir).find((name) => name.startsWith(".atomic-output.md.looppilot-") && name.endsWith(".old"));
if (!displacedOriginal) errors.push("failed atomic replacement deleted the displaced original");
else if (fs.readFileSync(path.join(tempDir, displacedOriginal), "utf8") !== "ORIGINAL") {
  errors.push("failed atomic replacement did not preserve original content");
}

fs.rmSync(tempDir, { recursive: true, force: true });
fs.rmSync(outsideDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot save command validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot save command validation passed.");
