#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const scanner = path.resolve(".looppilot/scripts/scan-summary.mjs");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-scan-security-"));
const errors = [];

fs.mkdirSync(path.join(tempDir, "secrets"), { recursive: true });
fs.mkdirSync(path.join(tempDir, ".ssh"), { recursive: true });
fs.mkdirSync(path.join(tempDir, ".aws"), { recursive: true });
fs.mkdirSync(path.join(tempDir, "nested"), { recursive: true });
fs.mkdirSync(path.join(tempDir, "node_modules", "unsafe-package"), { recursive: true });
fs.writeFileSync(path.join(tempDir, ".env"), "PASSWORD=super-secret-value\n", "utf8");
fs.writeFileSync(path.join(tempDir, "nested", ".env.local"), "NESTED_PASSWORD=nested-secret-value\n", "utf8");
fs.writeFileSync(path.join(tempDir, "secrets", "api.key"), "PRIVATE KEY should not leak\n", "utf8");
fs.writeFileSync(path.join(tempDir, ".ssh", "id_rsa"), "SSH SECRET should not leak\n", "utf8");
fs.writeFileSync(path.join(tempDir, ".aws", "credentials"), "AWS_SECRET_ACCESS_KEY=aws-secret-value\n", "utf8");
fs.writeFileSync(path.join(tempDir, "node_modules", "unsafe-package", ".env"), "DEPENDENCY_SECRET=dependency-secret-value\n", "utf8");
fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");

const result = spawnSync(process.execPath, [scanner], { cwd: tempDir, encoding: "utf8" });
if (result.status !== 0) errors.push(`scan helper failed: ${result.stderr || result.stdout}`);
else {
  try {
    const summary = JSON.parse(result.stdout);
    const serialized = JSON.stringify(summary);
    for (const forbidden of ["super-secret-value", "nested-secret-value", "PRIVATE KEY should not leak", "SSH SECRET should not leak", "aws-secret-value", "dependency-secret-value"]) {
      if (serialized.includes(forbidden)) errors.push(`scan leaked sensitive content: ${forbidden}`);
    }
    for (const expectedPath of [".env", "nested/.env.local", "secrets", "secrets/api.key", ".ssh", ".ssh/id_rsa", ".aws", ".aws/credentials"]) {
      if (!summary.risk?.sensitive_candidates?.includes(expectedPath)) {
        errors.push(`scan did not report ${expectedPath} as a sensitive candidate path`);
      }
    }
    if (summary.risk?.sensitive_candidates?.includes("node_modules/unsafe-package/.env")) {
      errors.push("scan should skip ignored dependency directories when discovering sensitive candidates");
    }
  } catch (error) {
    errors.push(`scan output was not JSON: ${error.message}`);
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot scan security validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot scan security validation passed.");
