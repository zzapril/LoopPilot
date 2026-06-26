#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

const safeSandboxEnvNames = [
  "CODEX_SANDBOX",
  "CODEX_SANDBOX_MODE",
  "SANDBOX_MODE",
  "CLAUDE_CODE_SANDBOX",
];

function commandAvailable(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

function readPackageScriptNames() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    if (!pkg?.scripts || typeof pkg.scripts !== "object" || Array.isArray(pkg.scripts)) return [];
    return Object.keys(pkg.scripts).sort();
  } catch {
    return [];
  }
}

function safeSandboxEnv() {
  const facts = {};
  for (const name of safeSandboxEnvNames) {
    if (!(name in process.env)) continue;
    const value = process.env[name] ?? "";
    facts[name] = /^[A-Za-z0-9_.:-]{0,80}$/.test(value) ? value : "<present>";
  }
  return facts;
}

function detectHost(sandboxEnv) {
  if ("CODEX_SANDBOX" in sandboxEnv || "CODEX_SANDBOX_MODE" in sandboxEnv) return "codex";
  if ("CLAUDE_CODE_SANDBOX" in sandboxEnv) return "claude_code";
  return "unknown";
}

const gitAvailable = commandAvailable("git");
const packageScripts = readPackageScriptNames();
const sandboxEnv = safeSandboxEnv();
const host = detectHost(sandboxEnv);

const summary = {
  host_capabilities: {
    host,
    can_edit_files: false,
    can_run_commands: true,
    has_approval_flow: false,
    supports_skills_or_commands: packageScripts.length > 0,
    capability_confidence: host === "unknown" ? "unknown" : "known",
  },
  evidence: {
    advisory_only: true,
    cwd: root,
    git_available: gitAvailable,
    package_scripts_exist: packageScripts.length > 0,
    package_script_names: packageScripts,
    sandbox_env: sandboxEnv,
  },
  guardrail: "Advisory evidence only; unknown host capability guardrails must still apply.",
};

console.log(JSON.stringify(summary, null, 2));
