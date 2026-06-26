#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const scanner = path.resolve(".looppilot/scripts/scan-summary.mjs");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-scan-security-"));
const errors = [];

fs.mkdirSync(path.join(tempDir, "nested"), { recursive: true });
fs.mkdirSync(path.join(tempDir, "config"), { recursive: true });
fs.mkdirSync(path.join(tempDir, "secrets"), { recursive: true });
fs.mkdirSync(path.join(tempDir, ".aws"), { recursive: true });
fs.mkdirSync(path.join(tempDir, ".ssh"), { recursive: true });
fs.writeFileSync(path.join(tempDir, "nested", ".env"), "PASSWORD=super-secret-value\n", "utf8");
fs.writeFileSync(path.join(tempDir, "config", "private.pem"), "PEM SECRET should not leak\n", "utf8");
fs.writeFileSync(path.join(tempDir, "secrets", "api.key"), "PRIVATE KEY should not leak\n", "utf8");
fs.writeFileSync(path.join(tempDir, ".aws", "credentials"), "AWS_SECRET_ACCESS_KEY=do-not-leak\n", "utf8");
fs.writeFileSync(path.join(tempDir, ".ssh", "id_rsa"), "SSH SECRET should not leak\n", "utf8");
fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");

const result = spawnSync(process.execPath, [scanner], { cwd: tempDir, encoding: "utf8" });
if (result.status !== 0) errors.push(`scan helper failed: ${result.stderr || result.stdout}`);
else {
  try {
    const summary = JSON.parse(result.stdout);
    const serialized = JSON.stringify(summary);
    for (const forbidden of ["super-secret-value", "PEM SECRET should not leak", "PRIVATE KEY should not leak", "AWS_SECRET_ACCESS_KEY=do-not-leak", "SSH SECRET should not leak"]) {
      if (serialized.includes(forbidden)) errors.push(`scan leaked sensitive content: ${forbidden}`);
    }

    const candidates = summary.risk?.sensitive_candidates ?? [];
    for (const expectedPath of ["nested/.env", "config/private.pem", "secrets/api.key", ".aws/credentials", ".ssh/id_rsa"]) {
      if (!candidates.includes(expectedPath)) errors.push(`scan did not report ${expectedPath} as a sensitive candidate path`);
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
