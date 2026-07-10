#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cli = path.resolve("scripts/looppilot.mjs");
const defaultExportDir = path.resolve(".looppilot/exports");
const errors = [];

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

const beforeDefaultExists = fs.existsSync(defaultExportDir);
const dryRun = run(["export", "--target", "codex", "--dry-run"]);
if (dryRun.status !== 0) errors.push(`dry-run export failed: ${dryRun.stderr || dryRun.stdout}`);
if (!beforeDefaultExists && fs.existsSync(defaultExportDir)) errors.push("dry-run created .looppilot/exports unexpectedly");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-export-"));
const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-export-project-"));
const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-export-outside-"));
const targets = [
  ["codex", "RUN_IN_CODEX.md", ["handoff prompt", "not controlled execution", "schema-valid JSON first"]],
  ["claude", "RUN_IN_CLAUDE.md", ["handoff prompt", "not controlled execution", "schema-valid JSON first"]],
  ["github-issue", "github-issue.md", ["handoff", "not controlled execution", "schema-valid JSON first"]],
];

for (const [target, fileName, requiredPhrases] of targets) {
  const output = path.join(tempDir, fileName);
  const explicit = run(["export", "--target", target, "--output", output]);
  if (explicit.status !== 0) errors.push(`explicit export failed for ${target}: ${explicit.stderr || explicit.stdout}`);
  if (!fs.existsSync(output)) errors.push(`explicit export did not write requested output file for ${target}`);
  else {
    const text = fs.readFileSync(output, "utf8");
    for (const phrase of requiredPhrases) {
      if (!text.includes(phrase)) errors.push(`explicit export output for ${target} missing ${phrase}`);
    }
  }

  const duplicate = run(["export", "--target", target, "--output", output]);
  if (duplicate.status === 0) errors.push(`duplicate explicit export for ${target} should require --force`);

  const forced = run(["export", "--target", target, "--output", output, "--force"]);
  if (forced.status !== 0) errors.push(`forced explicit export failed for ${target}: ${forced.stderr || forced.stdout}`);
}

const projectInstall = run(["install", "--cwd", projectDir]);
if (projectInstall.status !== 0) errors.push(`export safety project install failed: ${projectInstall.stderr || projectInstall.stdout}`);
else {
  const exportLink = path.join(projectDir, ".looppilot", "exports");
  fs.symlinkSync(outsideDir, exportLink, process.platform === "win32" ? "junction" : "dir");
  const linkedExport = run(["export", "--target", "codex", "--cwd", projectDir]);
  if (linkedExport.status === 0) errors.push("default export through a symlinked directory unexpectedly succeeded");
  if (!`${linkedExport.stderr}${linkedExport.stdout}`.includes("symbolic link path component")) {
    errors.push("symlinked export returned the wrong error");
  }
  if (fs.existsSync(path.join(outsideDir, "RUN_IN_CODEX.md"))) errors.push("export escaped the project through a symlink");

  fs.symlinkSync(outsideDir, path.join(projectDir, "..linked-output"), process.platform === "win32" ? "junction" : "dir");
  const dotdotLinkedExport = run(["export", "--target", "codex", "--cwd", projectDir, "--output", "..linked-output/handoff.md"]);
  if (dotdotLinkedExport.status === 0) errors.push("export through an in-project '..' prefix symlink unexpectedly succeeded");
  if (!`${dotdotLinkedExport.stderr}${dotdotLinkedExport.stdout}`.includes("symbolic link path component")) {
    errors.push("'..' prefix symlink export returned the wrong error");
  }
  if (fs.existsSync(path.join(outsideDir, "handoff.md"))) errors.push("'..' prefix export escaped the project");

  const protectedFile = path.join(projectDir, ".looppilot", "core", "report-template.md");
  const protectedBefore = fs.readFileSync(protectedFile, "utf8");
  const protectedExport = run(["export", "--target", "codex", "--cwd", projectDir, "--output", protectedFile, "--force"]);
  if (protectedExport.status === 0) errors.push("export unexpectedly overwrote an Agent Pack file");
  if (!`${protectedExport.stderr}${protectedExport.stdout}`.includes("refuses to overwrite Agent Pack file")) {
    errors.push("protected export returned the wrong error");
  }
  if (fs.readFileSync(protectedFile, "utf8") !== protectedBefore) errors.push("export changed a protected Agent Pack file");

  const caseVariantProtected = run(["export", "--target", "codex", "--cwd", projectDir, "--output", ".LOOPPILOT/core/report.md", "--force"]);
  if (caseVariantProtected.status === 0) errors.push("export protection was bypassed with a case-variant Agent Pack path");

  const packageJson = path.join(projectDir, "package.json");
  fs.writeFileSync(packageJson, "ORIGINAL", "utf8");
  const dependencyOutput = run(["export", "--target", "codex", "--cwd", projectDir, "--output", "package.json", "--force"]);
  if (dependencyOutput.status === 0) errors.push("export unexpectedly overwrote dependency metadata");
  if (!`${dependencyOutput.stderr}${dependencyOutput.stdout}`.includes("refuses to overwrite dependency metadata")) {
    errors.push("export dependency metadata protection returned the wrong error");
  }
  if (fs.readFileSync(packageJson, "utf8") !== "ORIGINAL") errors.push("export changed package.json");
}

fs.rmSync(tempDir, { recursive: true, force: true });
fs.rmSync(projectDir, { recursive: true, force: true });
fs.rmSync(outsideDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot export command validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot export command validation passed.");
