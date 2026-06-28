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

const expectedInstalledFiles = [
  ".looppilot/core/qualification-rules.md",
  ".looppilot/core/decision-schema.json",
  ".looppilot/core/contract-template.md",
  ".looppilot/core/export-template-codex.md",
  ".looppilot/core/export-template-claude.md",
  ".looppilot/core/export-template-github-issue.md",
  ".looppilot/core/report-template.md",
  ".looppilot/core/vision-template.md",
  ".looppilot/core/state-template.md",
  ".looppilot/core/run-log-template.md",
  ".looppilot/core/review-gate-template.md",
  ".looppilot/fixtures/decision-fixtures.jsonl",
  ".looppilot/scripts/scan-summary.mjs",
  ".looppilot/scripts/claude-project-summary.mjs",
  ".looppilot/scripts/host-capability-summary.mjs",
  ".looppilot/scripts/issue-intake.mjs",
  ".agents/skills/looppilot/SKILL.md",
  ".claude/skills/looppilot/SKILL.md",
  ".claude/commands/should-loop.md",
];

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

function runInProject(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: tempDir, encoding: "utf8" });
}

function assertDoctorMetadata(report, label) {
  const metadata = report.metadata;
  if (!metadata || typeof metadata !== "object") {
    errors.push(`${label} missing metadata`);
    return;
  }

  if (!(typeof metadata.commit === "string" || metadata.commit === null)) errors.push(`${label} metadata commit must be string or null`);
  if (metadata.package?.name !== packageInfo.name) errors.push(`${label} metadata package name mismatch`);
  if (metadata.package?.version !== packageInfo.version) errors.push(`${label} metadata package version mismatch`);
  if (metadata.schema?.id !== schemaInfo.$id) errors.push(`${label} metadata schema id mismatch`);
  if (metadata.target !== "both") errors.push(`${label} metadata target mismatch`);
  if (metadata.project !== tempDir) errors.push(`${label} metadata project mismatch`);
  if (typeof metadata.timestamp !== "string" || Number.isNaN(Date.parse(metadata.timestamp))) {
    errors.push(`${label} metadata timestamp was not an ISO date`);
  }
  if (metadata.fixture?.total !== 45) errors.push(`${label} metadata fixture total mismatch`);
  for (const decision of ["NO_GO", "PLAN_ONLY", "RUN_WITH_CONTRACT"]) {
    if (metadata.fixture?.counts?.[decision] !== 15) errors.push(`${label} metadata fixture count mismatch for ${decision}`);
  }
  if (!Array.isArray(metadata.wrapper_files) || metadata.wrapper_files.length !== 3) {
    errors.push(`${label} metadata wrapper_files mismatch`);
  }
  if (!Array.isArray(metadata.core_files) || metadata.core_files.length !== 16) {
    errors.push(`${label} metadata core_files mismatch`);
  }
  if (!Number.isInteger(metadata.duration_ms) || metadata.duration_ms < 0) {
    errors.push(`${label} metadata duration_ms must be a non-negative integer`);
  }
  if (metadata.installedFileCount !== expectedInstalledFiles.length) errors.push(`${label} metadata installed file count mismatch`);
  if (metadata.missingFileCount !== 0) errors.push(`${label} metadata missing file count mismatch`);
  if (!Array.isArray(metadata.files) || metadata.files.length !== metadata.installedFileCount) {
    errors.push(`${label} metadata files array mismatch`);
  } else if (metadata.files.some((file) => typeof file.path !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256))) {
    errors.push(`${label} metadata files contained invalid hashes`);
  }
}

function assertDoctorCommand(target) {
  const doctor = run(["doctor", "--target", target, "--cwd", tempDir, "--json"]);
  if (doctor.status !== 0) {
    errors.push(`doctor --target ${target} --json failed after install: ${doctor.stderr || doctor.stdout}`);
    return null;
  }

  try {
    const report = JSON.parse(doctor.stdout);
    if (!report.ok) errors.push(`doctor --target ${target} --json report was not ok`);
    return report;
  } catch (error) {
    errors.push(`doctor --target ${target} --json output was not JSON: ${error.message}`);
    return null;
  }
}

const install = runInProject(["install"]);
if (install.status !== 0) errors.push(`install failed: ${install.stderr || install.stdout}`);
else {
  for (const expected of [
    "Next:",
    "Claude Code: /should-loop <task-or-issue-url>",
    "Codex: Use LoopPilot on <task-or-issue-url>",
    "Verify: looppilot doctor",
  ]) {
    if (!install.stdout.includes(expected)) errors.push(`install output missing ${expected}`);
  }
}

const missingInstallDir = `${tempDir}-missing`;
const missingInstall = run(["install", "--target", "both", "--scope", "project", "--cwd", missingInstallDir, "--dry-run"]);
if (missingInstall.status === 0) {
  errors.push("install --cwd missing directory unexpectedly succeeded");
} else {
  const output = `${missingInstall.stderr}${missingInstall.stdout}`;
  if (!output.includes("Project directory does not exist")) {
    errors.push(`install --cwd missing directory returned unclear error: ${output.trim()}`);
  }
}
if (fs.existsSync(missingInstallDir)) errors.push("install --cwd missing directory created the target directory");

for (const file of expectedInstalledFiles) {
  if (!fs.existsSync(path.join(tempDir, file))) errors.push(`installed project missing ${file}`);
}

const doctorJsonReport = assertDoctorCommand("both");
if (doctorJsonReport) {
  if (!Array.isArray(doctorJsonReport.checks) || doctorJsonReport.checks.length === 0) errors.push("doctor --json missing checks");
  assertDoctorMetadata(doctorJsonReport, "doctor --json");
}

const defaultDoctor = runInProject(["doctor", "--json"]);
if (defaultDoctor.status !== 0) errors.push(`doctor --json default target failed after install: ${defaultDoctor.stderr || defaultDoctor.stdout}`);
else {
  try {
    const report = JSON.parse(defaultDoctor.stdout);
    if (!report.ok) errors.push("doctor --json default target report was not ok");
    if (report.target !== "both") errors.push("doctor --json default target was not both");
  } catch (error) {
    errors.push(`doctor --json default target output was not JSON: ${error.message}`);
  }
}

for (const target of ["codex", "claude"]) {
  const report = assertDoctorCommand(target);
  if (report?.target !== target) errors.push(`doctor --target ${target} report target mismatch`);
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
