#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cli = path.resolve("scripts/looppilot.mjs");
const packageInfo = JSON.parse(fs.readFileSync("package.json", "utf8"));
const schemaInfo = JSON.parse(fs.readFileSync(".looppilot/core/decision-schema.json", "utf8"));
const fixtureInfo = fs.readFileSync(".looppilot/fixtures/decision-fixtures.jsonl", "utf8").trim().split(/\n/).map(JSON.parse);
const fixtureCounts = Object.fromEntries(["NO_GO", "PLAN_ONLY", "RUN_WITH_CONTRACT"].map((decision) => [
  decision,
  fixtureInfo.filter((fixture) => fixture.category === decision).length,
]));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-install-"));
const conflictDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-install-conflict-"));
const symlinkDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-install-symlink-"));
const symlinkOutsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-install-outside-"));
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
  ".looppilot/scripts/file-safety.mjs",
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
  if (metadata.fixture?.total !== fixtureInfo.length) errors.push(`${label} metadata fixture total mismatch`);
  for (const [decision, expectedCount] of Object.entries(fixtureCounts)) {
    if (metadata.fixture?.counts?.[decision] !== expectedCount) {
      errors.push(`${label} metadata fixture count mismatch for ${decision}`);
    }
  }
  if (!Array.isArray(metadata.wrapper_files) || metadata.wrapper_files.length !== 3) {
    errors.push(`${label} metadata wrapper_files mismatch`);
  }
  if (!Array.isArray(metadata.core_files) || metadata.core_files.length !== 17) {
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

const lateConflict = path.join(conflictDir, ".claude", "commands", "should-loop.md");
fs.mkdirSync(path.dirname(lateConflict), { recursive: true });
fs.writeFileSync(lateConflict, "# existing project command\n", "utf8");
const conflictedInstall = run(["install", "--cwd", conflictDir]);
if (conflictedInstall.status === 0) errors.push("install with a late conflict unexpectedly succeeded");
if (!`${conflictedInstall.stderr}${conflictedInstall.stdout}`.includes("already exists and differs")) {
  errors.push("install with a late conflict returned the wrong error");
}
if (fs.existsSync(path.join(conflictDir, ".looppilot", "core", "qualification-rules.md"))) {
  errors.push("install wrote earlier files before detecting a late conflict");
}
if (fs.readFileSync(lateConflict, "utf8") !== "# existing project command\n") {
  errors.push("install changed the conflicting project file");
}

fs.symlinkSync(symlinkOutsideDir, path.join(symlinkDir, ".looppilot"), process.platform === "win32" ? "junction" : "dir");
const symlinkInstall = run(["install", "--cwd", symlinkDir]);
if (symlinkInstall.status === 0) errors.push("install through a symlinked pack directory unexpectedly succeeded");
if (!`${symlinkInstall.stderr}${symlinkInstall.stdout}`.includes("symbolic link path component")) {
  errors.push("install through a symlinked pack directory returned the wrong error");
}
if (fs.existsSync(path.join(symlinkOutsideDir, "core", "decision-schema.json"))) {
  errors.push("install escaped the project through a symlinked pack directory");
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

const doctorOutsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-doctor-outside-"));
fs.symlinkSync(doctorOutsideDir, path.join(tempDir, "linked-reports"), process.platform === "win32" ? "junction" : "dir");
const linkedDoctorOutput = run(["doctor", "--target", "both", "--cwd", tempDir, "--json", "--output", "linked-reports/doctor.json"]);
if (linkedDoctorOutput.status === 0) errors.push("doctor output through a symlinked directory unexpectedly succeeded");
if (!`${linkedDoctorOutput.stderr}${linkedDoctorOutput.stdout}`.includes("symbolic link path component")) {
  errors.push("doctor symlink output returned the wrong error");
}
if (fs.existsSync(path.join(doctorOutsideDir, "doctor.json"))) errors.push("doctor output escaped the project through a symlink");

const protectedSchemaPath = path.join(tempDir, ".looppilot", "core", "decision-schema.json");
const protectedSchemaBefore = fs.readFileSync(protectedSchemaPath, "utf8");
const protectedDoctorOutput = run(["doctor", "--target", "both", "--cwd", tempDir, "--json", "--output", ".looppilot/core/decision-schema.json", "--force"]);
if (protectedDoctorOutput.status === 0) errors.push("doctor unexpectedly overwrote an Agent Pack schema file");
if (!`${protectedDoctorOutput.stderr}${protectedDoctorOutput.stdout}`.includes("refuses to overwrite Agent Pack file")) {
  errors.push("doctor protected output returned the wrong error");
}
if (fs.readFileSync(protectedSchemaPath, "utf8") !== protectedSchemaBefore) errors.push("doctor changed a protected Agent Pack file");
fs.rmSync(doctorOutsideDir, { recursive: true, force: true });

const staleWrapper = path.join(tempDir, ".agents", "skills", "looppilot", "SKILL.md");
fs.appendFileSync(staleWrapper, "\n<!-- stale local copy -->\n", "utf8");
const staleDoctor = run(["doctor", "--target", "both", "--cwd", tempDir, "--json"]);
if (staleDoctor.status === 0) errors.push("doctor unexpectedly accepted a stale installed pack file");
if (!`${staleDoctor.stderr}${staleDoctor.stdout}`.includes("differs from package source")) {
  errors.push("doctor stale-pack failure did not explain how to refresh the Agent Pack");
}
const refreshInstall = run(["install", "--target", "both", "--cwd", tempDir, "--force"]);
if (refreshInstall.status !== 0) errors.push(`install --force failed to refresh a stale pack: ${refreshInstall.stderr || refreshInstall.stdout}`);
const refreshedDoctor = run(["doctor", "--target", "both", "--cwd", tempDir, "--json"]);
if (refreshedDoctor.status !== 0) errors.push(`doctor failed after refreshing a stale pack: ${refreshedDoctor.stderr || refreshedDoctor.stdout}`);

fs.rmSync(tempDir, { recursive: true, force: true });
fs.rmSync(conflictDir, { recursive: true, force: true });
fs.rmSync(symlinkDir, { recursive: true, force: true });
fs.rmSync(symlinkOutsideDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot install command validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot install command validation passed.");
