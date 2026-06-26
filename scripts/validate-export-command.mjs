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

fs.rmSync(tempDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot export command validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot export command validation passed.");
