#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cli = path.resolve("scripts/looppilot.mjs");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-install-"));
const errors = [];
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

const install = run(["install", "--target", "both", "--scope", "project", "--cwd", tempDir]);
if (install.status !== 0) errors.push(`install failed: ${install.stderr || install.stdout}`);

for (const file of [
  ".looppilot/core/qualification-rules.md",
  ".looppilot/core/decision-schema.json",
  ".looppilot/core/contract-template.md",
  ".looppilot/fixtures/decision-fixtures.jsonl",
  ".looppilot/scripts/scan-summary.mjs",
  ".agents/skills/looppilot/SKILL.md",
  ".claude/skills/looppilot/SKILL.md",
  ".claude/commands/should-loop.md",
]) {
  if (!fs.existsSync(path.join(tempDir, file))) errors.push(`installed project missing ${file}`);
}

const doctorOutput = path.join(tempDir, "doctor-report.json");
const doctorJson = run(["doctor", "--target", "both", "--cwd", tempDir, "--json", "--output", doctorOutput]);
if (doctorJson.status !== 0) errors.push(`doctor --json --output failed after install: ${doctorJson.stderr || doctorJson.stdout}`);
else {
  try {
    const report = JSON.parse(fs.readFileSync(doctorOutput, "utf8"));
    if (!report.ok) errors.push("doctor --json --output report was not ok");
    if (!Array.isArray(report.checks) || report.checks.length === 0) errors.push("doctor --json --output missing checks");

    const requiredMetadata = [
      "commit",
      "package_name",
      "package_version",
      "fixture_total",
      "fixture_counts",
      "wrapper_files",
      "core_files",
      "duration_ms",
    ];
    for (const field of requiredMetadata) {
      if (!(field in report)) errors.push(`doctor --json --output missing metadata field ${field}`);
    }

    if (!(typeof report.commit === "string" || report.commit === null)) errors.push("doctor commit must be string or null");
    if (report.package_name !== packageJson.name) errors.push("doctor package_name did not match package.json");
    if (report.package_version !== packageJson.version) errors.push("doctor package_version did not match package.json");
    if (report.fixture_total !== 45) errors.push("doctor fixture_total did not include parsed fixture count");
    for (const decision of ["NO_GO", "PLAN_ONLY", "RUN_WITH_CONTRACT"]) {
      if (report.fixture_counts?.[decision] !== 15) errors.push(`doctor fixture_counts.${decision} did not include parsed fixture count`);
    }
    if (!Array.isArray(report.wrapper_files) || report.wrapper_files.length !== 3) errors.push("doctor wrapper_files did not list both target wrappers");
    if (!Array.isArray(report.core_files) || report.core_files.length === 0) errors.push("doctor core_files was empty");
    if (!Number.isInteger(report.duration_ms) || report.duration_ms < 0) errors.push("doctor duration_ms must be a non-negative integer");
  } catch (error) {
    errors.push(`doctor --json --output report was not JSON: ${error.message}`);
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot install command validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot install command validation passed.");
