#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const commands = [
  ["node", ["scripts/validate-schema.mjs"]],
  ["node", ["scripts/generate-schema-validator.mjs", "--check"]],
  ["node", ["scripts/validate-schema-ajv.mjs"]],
  ["node", ["scripts/validate-fixtures.mjs"]],
  ["node", ["scripts/validate-wrappers.mjs"]],
  ["node", ["scripts/validate-wrapper-parity.mjs"]],
  ["node", ["scripts/validate-scan-summary.mjs"]],
  ["node", ["scripts/validate-scan-security.mjs"]],
  ["node", ["scripts/validate-claude-project-summary.mjs"]],
  ["node", ["scripts/validate-host-capability-summary.mjs"]],
  ["node", ["scripts/validate-issue-intake.mjs"]],
  ["node", ["scripts/validate-exports.mjs"]],
  ["node", ["scripts/report-fixture-coverage.mjs"]],
  ["node", ["scripts/validate-export-command.mjs"]],
  ["node", ["scripts/validate-save-commands.mjs"]],
  ["node", ["scripts/validate-manual-templates.mjs"]],
  ["node", ["scripts/validate-review-gate-template.mjs"]],
  ["node", ["scripts/validate-package-contents.mjs"]],
  ["node", ["scripts/validate-docs-consistency.mjs"]],
  ["node", ["scripts/validate-workflows.mjs"]],
  ["node", ["scripts/validate-install-command.mjs"]],
  ["node", ["scripts/validate-cli-args.mjs"]],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: "inherit", timeout: 120_000 });
  if (result.error?.code === "ETIMEDOUT") {
    console.error(`LoopPilot validation timed out: ${command} ${args.join(" ")}`);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
