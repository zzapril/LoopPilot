#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const scanner = path.resolve(".looppilot/scripts/scan-summary.mjs");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-scan-security-"));
const limitDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-scan-limit-"));
const errors = [];

fs.mkdirSync(path.join(tempDir, "secrets"), { recursive: true });
fs.mkdirSync(path.join(tempDir, ".ssh"), { recursive: true });
fs.mkdirSync(path.join(tempDir, ".aws"), { recursive: true });
fs.mkdirSync(path.join(tempDir, "nested"), { recursive: true });
fs.mkdirSync(path.join(tempDir, "node_modules", "unsafe-package"), { recursive: true });
fs.mkdirSync(path.join(tempDir, "src", "auth"), { recursive: true });
fs.writeFileSync(path.join(tempDir, ".env"), "PASSWORD=super-secret-value\n", "utf8");
fs.writeFileSync(path.join(tempDir, ".npmrc"), "//registry.npmjs.org/:_authToken=npmrc-secret-value\n", "utf8");
fs.writeFileSync(path.join(tempDir, "nested", ".env.local"), "NESTED_PASSWORD=nested-secret-value\n", "utf8");
fs.writeFileSync(path.join(tempDir, "secrets", "api.key"), "PRIVATE KEY should not leak\n", "utf8");
fs.writeFileSync(path.join(tempDir, ".ssh", "id_rsa"), "SSH SECRET should not leak\n", "utf8");
fs.writeFileSync(path.join(tempDir, ".aws", "credentials"), "AWS_SECRET_ACCESS_KEY=aws-secret-value\n", "utf8");
fs.writeFileSync(path.join(tempDir, "node_modules", "unsafe-package", ".env"), "DEPENDENCY_SECRET=dependency-secret-value\n", "utf8");
fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
fs.writeFileSync(path.join(tempDir, "src", "auth", "index.js"), "export const safe = true;\n", "utf8");
fs.writeFileSync(path.join(tempDir, "src", "payment.ts"), "export const total = 0;\n", "utf8");

const result = spawnSync(process.execPath, [scanner], { cwd: tempDir, encoding: "utf8" });
if (result.status !== 0) errors.push(`scan helper failed: ${result.stderr || result.stdout}`);
else {
  try {
    const summary = JSON.parse(result.stdout);
    const serialized = JSON.stringify(summary);
    for (const forbidden of ["super-secret-value", "npmrc-secret-value", "nested-secret-value", "PRIVATE KEY should not leak", "SSH SECRET should not leak", "aws-secret-value", "dependency-secret-value"]) {
      if (serialized.includes(forbidden)) errors.push(`scan leaked sensitive content: ${forbidden}`);
    }
    for (const expectedPath of [".env", ".npmrc", "nested/.env.local", "secrets", "secrets/api.key", ".ssh", ".ssh/id_rsa", ".aws", ".aws/credentials"]) {
      if (!summary.risk?.sensitive_candidates?.includes(expectedPath)) {
        errors.push(`scan did not report ${expectedPath} as a sensitive candidate path`);
      }
    }
    if (summary.risk?.sensitive_candidates?.includes("node_modules/unsafe-package/.env")) {
      errors.push("scan should skip ignored dependency directories when discovering sensitive candidates");
    }
    if (!summary.risk?.risk_paths?.includes("src/auth")) {
      errors.push("scan did not report a nested clean risk path");
    }
    if (!summary.risk?.risk_paths?.includes("src/payment.ts")) {
      errors.push("scan did not report a risk-keyword filename");
    }
    if (summary.repo?.git_status !== "failed" || summary.repo?.dirty !== null) {
      errors.push("scan should report failed git evidence as unknown, not clean");
    }
  } catch (error) {
    errors.push(`scan output was not JSON: ${error.message}`);
  }
}

const unavailableGit = spawnSync(process.execPath, [scanner], {
  cwd: tempDir,
  encoding: "utf8",
  env: { ...process.env, PATH: "" },
});
if (unavailableGit.status !== 0) errors.push(`scan without git failed: ${unavailableGit.stderr || unavailableGit.stdout}`);
else {
  try {
    const summary = JSON.parse(unavailableGit.stdout);
    if (summary.repo?.git_status !== "unavailable" || summary.repo?.dirty !== null) {
      errors.push("scan should distinguish unavailable git from a clean repository");
    }
  } catch (error) {
    errors.push(`scan without git output was not JSON: ${error.message}`);
  }
}

const manyEntriesDir = path.join(limitDir, "many");
fs.mkdirSync(manyEntriesDir);
for (let index = 0; index < 10005; index += 1) {
  fs.writeFileSync(path.join(manyEntriesDir, `entry-${index}`), "", "utf8");
}
const boundedScan = spawnSync(process.execPath, [scanner], { cwd: limitDir, encoding: "utf8" });
if (boundedScan.status !== 0) errors.push(`bounded scan failed: ${boundedScan.stderr || boundedScan.stdout}`);
else {
  try {
    const summary = JSON.parse(boundedScan.stdout);
    if (summary.risk?.inspected_entries !== 10000 || summary.risk?.scan_truncated !== true) {
      errors.push(`scan traversal bound was not exact: ${JSON.stringify(summary.risk)}`);
    }
  } catch (error) {
    errors.push(`bounded scan output was not JSON: ${error.message}`);
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });
fs.rmSync(limitDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot scan security validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot scan security validation passed.");
