#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync("node", [".looppilot/scripts/scan-summary.mjs"], { encoding: "utf8" });
if (result.status !== 0) {
  console.error("LoopPilot scan summary validation failed:");
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

let summary;
try {
  summary = JSON.parse(result.stdout);
} catch (error) {
  console.error(`LoopPilot scan summary validation failed: invalid JSON: ${error.message}`);
  process.exit(1);
}

const errors = [];
if (!["ok", "unavailable", "failed"].includes(summary.repo?.git_status)) errors.push("repo.git_status must be ok, unavailable, or failed");
if (!(typeof summary.repo?.dirty === "boolean" || summary.repo?.dirty === null)) errors.push("repo.dirty must be boolean or null");
if (!(typeof summary.repo?.diff_stat === "string" || summary.repo?.diff_stat === null)) errors.push("repo.diff_stat must be string or null");
if (!Array.isArray(summary.repo?.changed_files)) errors.push("repo.changed_files must be an array");
if (!Array.isArray(summary.project?.languages)) errors.push("project.languages must be an array");
if (!Array.isArray(summary.project?.test_commands)) errors.push("project.test_commands must be an array");
if (!Array.isArray(summary.project?.build_commands)) errors.push("project.build_commands must be an array");
if (!Array.isArray(summary.risk?.risk_paths)) errors.push("risk.risk_paths must be an array");
if (!Array.isArray(summary.risk?.sensitive_candidates)) errors.push("risk.sensitive_candidates must be an array");
if (!Number.isInteger(summary.risk?.inspected_entries)) errors.push("risk.inspected_entries must be an integer");
if (typeof summary.risk?.scan_truncated !== "boolean") errors.push("risk.scan_truncated must be boolean");

const serialized = JSON.stringify(summary);
for (const forbiddenContentHint of ["PRIVATE KEY", "AWS_SECRET_ACCESS_KEY", "PASSWORD="]) {
  if (serialized.includes(forbiddenContentHint)) errors.push(`scan output appears to include secret content: ${forbiddenContentHint}`);
}

if (errors.length > 0) {
  console.error("LoopPilot scan summary validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot scan summary validation passed.");
console.log(`Changed files: ${summary.repo.changed_files.length}`);
console.log(`Sensitive candidates: ${summary.risk.sensitive_candidates.length}`);
