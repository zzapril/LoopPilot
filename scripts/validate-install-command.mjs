#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cli = path.resolve("scripts/looppilot.mjs");
const packageInfo = JSON.parse(fs.readFileSync("package.json", "utf8"));
const schemaInfo = JSON.parse(fs.readFileSync(".looppilot/core/decision-schema.json", "utf8"));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-install-"));
const errors = [];

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

function assertDoctorMetadata(report, label) {
  const metadata = report.metadata;
  if (!metadata || typeof metadata !== "object") {
    errors.push(`${label} missing metadata`);
    return;
  }
  if (metadata.package?.name !== packageInfo.name) errors.push(`${label} metadata package name mismatch`);
  if (metadata.package?.version !== packageInfo.version) errors.push(`${label} metadata package version mismatch`);
  if (metadata.schema?.id !== schemaInfo.$id) errors.push(`${label} metadata schema id mismatch`);
  if (metadata.target !== "both") errors.push(`${label} metadata target mismatch`);
  if (metadata.project !== tempDir) errors.push(`${label} metadata project mismatch`);
  if (typeof metadata.timestamp !== "string" || Number.isNaN(Date.parse(metadata.timestamp))) {
    errors.push(`${label} metadata timestamp was not an ISO date`);
  }
  if (metadata.installedFileCount !== 12) errors.push(`${label} metadata installed file count mismatch`);
  if (metadata.missingFileCount !== 0) errors.push(`${label} metadata missing file count mismatch`);
  if (!Array.isArray(metadata.files) || metadata.files.length !== metadata.installedFileCount) {
    errors.push(`${label} metadata files array mismatch`);
  } else if (metadata.files.some((file) => typeof file.path !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256))) {
    errors.push(`${label} metadata files contained invalid hashes`);
  }
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

const doctorJson = run(["doctor", "--target", "both", "--cwd", tempDir, "--json"]);
if (doctorJson.status !== 0) errors.push(`doctor --json failed after install: ${doctorJson.stderr || doctorJson.stdout}`);
else {
  try {
    const report = JSON.parse(doctorJson.stdout);
    if (!report.ok) errors.push("doctor --json report was not ok");
    if (!Array.isArray(report.checks) || report.checks.length === 0) errors.push("doctor --json missing checks");
    assertDoctorMetadata(report, "doctor --json");
  } catch (error) {
    errors.push(`doctor --json output was not JSON: ${error.message}`);
  }
}

const doctorOutputPath = "reports/doctor.json";
const doctorJsonOutput = run(["doctor", "--target", "both", "--cwd", tempDir, "--json", "--output", doctorOutputPath]);
if (doctorJsonOutput.status !== 0) errors.push(`doctor --json --output failed after install: ${doctorJsonOutput.stderr || doctorJsonOutput.stdout}`);
else {
  const absoluteDoctorOutputPath = path.join(tempDir, doctorOutputPath);
  if (!fs.existsSync(absoluteDoctorOutputPath)) errors.push("doctor --json --output did not write output file");
  else {
    try {
      const report = JSON.parse(fs.readFileSync(absoluteDoctorOutputPath, "utf8"));
      if (!report.ok) errors.push("doctor --json --output report was not ok");
      assertDoctorMetadata(report, "doctor --json --output");
    } catch (error) {
      errors.push(`doctor --json --output file was not JSON: ${error.message}`);
    }
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot install command validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot install command validation passed.");
