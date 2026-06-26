#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cli = path.resolve("scripts/looppilot.mjs");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-install-"));
const errors = [];

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

const install = run(["install", "--target", "both", "--scope", "project", "--cwd", tempDir]);
if (install.status !== 0) errors.push(`install failed: ${install.stderr || install.stdout}`);

for (const file of [
  ".looppilot/core/qualification-rules.md",
  ".looppilot/core/decision-schema.json",
  ".looppilot/core/contract-template.md",
  ".looppilot/core/review-gate-template.md",
  ".looppilot/fixtures/decision-fixtures.jsonl",
  ".looppilot/scripts/scan-summary.mjs",
  ".agents/skills/looppilot/SKILL.md",
  ".claude/skills/looppilot/SKILL.md",
  ".claude/commands/should-loop.md",
]) {
  if (!fs.existsSync(path.join(tempDir, file))) errors.push(`installed project missing ${file}`);
}

const doctorJson = run(["doctor", "--target", "both", "--cwd", tempDir, "--json"]);
if (doctorJson.status !== 0) errors.push(`doctor --json failed after install: ${doctorJson.stderr || doctorJson.stdout}`);
else {
  try {
    const report = JSON.parse(doctorJson.stdout);
    if (!report.ok) errors.push("doctor --json report was not ok");
    if (!Array.isArray(report.checks) || report.checks.length === 0) errors.push("doctor --json missing checks");
  } catch (error) {
    errors.push(`doctor --json output was not JSON: ${error.message}`);
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot install command validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot install command validation passed.");
