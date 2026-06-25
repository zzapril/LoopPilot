#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const commands = [
  ["node", ["scripts/validate-fixtures.mjs"]],
  ["node", ["scripts/validate-wrappers.mjs"]],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
