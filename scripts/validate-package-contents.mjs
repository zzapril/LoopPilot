#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-npm-cache-"));
const errors = [];

const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  env: {
    ...process.env,
    npm_config_cache: cacheDir,
  },
});

if (result.status !== 0) {
  errors.push(`npm pack --dry-run --json failed: ${result.stderr || result.stdout}`);
} else {
  try {
    const parsed = JSON.parse(result.stdout);
    const files = new Set((parsed[0]?.files ?? []).map((file) => file.path));
    const requiredFiles = [
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
      ".agents/skills/looppilot/SKILL.md",
      ".claude/skills/looppilot/SKILL.md",
      ".claude/commands/should-loop.md",
      "scripts/looppilot.mjs",
      "scripts/validate-all.mjs",
      "scripts/validate-docs-consistency.mjs",
      "scripts/validate-package-contents.mjs",
      "scripts/lib/decision-validator.mjs",
      "scripts/lib/schema-validator.mjs",
      "scripts/lib/wrapper-validator.mjs",
      "README.md",
      "LICENSE",
      "package.json",
    ];
    const forbiddenPrefixes = [
      ".looppilot/exports/",
      ".looppilot/latest-",
      "docs/",
    ];
    const forbiddenFiles = [
      ".looppilot/latest-contract.md",
      ".looppilot/latest-report.md",
      ".looppilot/latest-review-gate.md",
      ".looppilot/VISION.md",
      ".looppilot/STATE.md",
      ".looppilot/RUN_LOG.md",
    ];

    for (const file of requiredFiles) {
      if (!files.has(file)) errors.push(`package contents missing ${file}`);
    }
    for (const file of files) {
      if (forbiddenFiles.includes(file)) errors.push(`package contents included generated file ${file}`);
      if (forbiddenPrefixes.some((prefix) => file.startsWith(prefix))) {
        errors.push(`package contents included forbidden path ${file}`);
      }
    }
  } catch (error) {
    errors.push(`npm pack --dry-run --json output was not JSON: ${error.message}`);
  }
}

fs.rmSync(cacheDir, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot package contents validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot package contents validation passed.");
