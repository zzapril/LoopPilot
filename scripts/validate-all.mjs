#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const commands = [
  ["node", ["scripts/validate-schema.mjs"]],
  ["node", ["scripts/validate-fixtures.mjs"]],
  ["node", ["scripts/validate-wrappers.mjs"]],
  ["node", ["scripts/validate-wrapper-parity.mjs"]],
  ["node", ["scripts/validate-scan-summary.mjs"]],
  ["node", ["scripts/validate-scan-security.mjs"]],
  ["node", ["scripts/validate-claude-project-summary.mjs"]],
  ["node", ["scripts/validate-exports.mjs"]],
  ["node", ["scripts/report-fixture-coverage.mjs"]],
  ["node", ["scripts/validate-export-command.mjs"]],
  ["node", ["scripts/validate-save-commands.mjs"]],
  ["node", ["scripts/validate-install-command.mjs"]],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
