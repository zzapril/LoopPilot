#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const scanner = path.resolve(".looppilot/scripts/claude-project-summary.mjs");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-claude-project-summary-"));
const errors = [];

fs.mkdirSync(path.join(tempDir, ".claude", "skills", "looppilot"), { recursive: true });
fs.mkdirSync(path.join(tempDir, ".claude", "commands"), { recursive: true });
fs.writeFileSync(path.join(tempDir, ".claude", "skills", "looppilot", "SKILL.md"), "# safe wrapper marker\n", "utf8");
fs.writeFileSync(path.join(tempDir, ".claude", "commands", "should-loop.md"), "Use the skill.\n", "utf8");
fs.writeFileSync(path.join(tempDir, ".claude", "settings.json"), JSON.stringify({
  permissions: {
    allow: ["Bash(npm test)", "Read(./README.md)"],
    deny: ["Read(./.env)", "SECRET_TOKEN_DO_NOT_LEAK"],
  },
  hooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo SHOULD_NOT_LEAK" }] }],
  },
  env: {
    API_KEY: "super-secret-value",
  },
}, null, 2), "utf8");

const result = spawnSync(process.execPath, [scanner], { cwd: tempDir, encoding: "utf8" });
if (result.status !== 0) errors.push(`Claude project summary helper failed: ${result.stderr || result.stdout}`);
else {
  try {
    const summary = JSON.parse(result.stdout);
    const serialized = JSON.stringify(summary);
    for (const forbidden of ["super-secret-value", "SECRET_TOKEN_DO_NOT_LEAK", "SHOULD_NOT_LEAK", "Bash(npm test)"]) {
      if (serialized.includes(forbidden)) errors.push(`Claude project summary leaked config content: ${forbidden}`);
    }
    if (summary.claude_wrapper_exists !== true) errors.push("Claude wrapper presence was not detected");
    if (summary.command_alias_exists !== true) errors.push("Claude command alias presence was not detected");
    if (summary.project_permission_metadata_present !== true) errors.push("Claude permission metadata presence was not detected");
    if (summary.project_hook_metadata_present !== true) errors.push("Claude hook metadata presence was not detected");
    if (!Array.isArray(summary.inspected_project_settings_files)) errors.push("inspected_project_settings_files must be an array");
    if (summary.inspected_project_settings_files?.[0]?.path !== ".claude/settings.json") errors.push("expected only documented project settings path metadata");
  } catch (error) {
    errors.push(`Claude project summary output was not JSON: ${error.message}`);
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot Claude project summary validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot Claude project summary validation passed.");
