#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateJsonSchema } from "./lib/schema-validator.mjs";

const helper = path.resolve(".looppilot/scripts/host-capability-summary.mjs");
const schema = JSON.parse(fs.readFileSync(path.resolve(".looppilot/core/decision-schema.json"), "utf8"));
const hostCapabilitiesSchema = schema.$defs.hostCapabilities;
const errors = [];
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-host-capability-"));
const secretValues = ["super-secret-token", "PRIVATE CONFIG VALUE", "ssh-private-key"];

fs.writeFileSync(path.join(tempDir, ".env"), `TOKEN=${secretValues[0]}\n`, "utf8");
fs.writeFileSync(path.join(tempDir, "private.config"), secretValues[1], "utf8");
fs.mkdirSync(path.join(tempDir, ".ssh"), { recursive: true });
fs.writeFileSync(path.join(tempDir, ".ssh", "id_rsa"), secretValues[2], "utf8");
fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ scripts: { test: "node --test", build: "vite build" } }), "utf8");

const result = spawnSync(process.execPath, [helper], {
  cwd: tempDir,
  encoding: "utf8",
  env: {
    ...process.env,
    CODEX_SANDBOX_MODE: "workspace-write",
    API_TOKEN: secretValues[0],
    PRIVATE_CONFIG: secretValues[1],
  },
});

if (result.status !== 0) errors.push(`host capability helper failed: ${result.stderr || result.stdout}`);
else {
  try {
    const summary = JSON.parse(result.stdout);
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) errors.push("summary must be an object");
    if (!summary.host_capabilities) errors.push("summary.host_capabilities is required");
    else errors.push(...validateJsonSchema(summary.host_capabilities, hostCapabilitiesSchema, "host_capabilities"));
    if (summary.evidence?.cwd !== tempDir) errors.push("summary did not report current working directory evidence");
    if (summary.evidence?.git_available === undefined) errors.push("summary did not report git availability evidence");
    if (summary.evidence?.package_scripts_exist !== true) errors.push("summary did not report package script existence");
    if (!Array.isArray(summary.evidence?.package_script_names) || !summary.evidence.package_script_names.includes("test")) {
      errors.push("summary did not report package script names");
    }
    if (summary.evidence?.sandbox_env?.CODEX_SANDBOX_MODE !== "workspace-write") {
      errors.push("summary did not report safe sandbox environment evidence");
    }
    if (summary.guardrail !== "Advisory evidence only; unknown host capability guardrails must still apply.") {
      errors.push("summary guardrail text is missing or changed");
    }
    const serialized = JSON.stringify(summary);
    for (const secret of secretValues) {
      if (serialized.includes(secret)) errors.push(`host capability summary leaked secret/private content: ${secret}`);
    }
    if (serialized.includes("API_TOKEN") || serialized.includes("PRIVATE_CONFIG")) {
      errors.push("host capability summary included non-allowlisted environment variable names");
    }
  } catch (error) {
    errors.push(`host capability summary output was not JSON: ${error.message}`);
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot host capability summary validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot host capability summary validation passed.");
