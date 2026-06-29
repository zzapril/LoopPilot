#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const requiredCoreRefs = [
  ".looppilot/core/qualification-rules.md",
  ".looppilot/core/decision-schema.json",
  ".looppilot/core/contract-template.md",
];

const guardrails = [
  "Unknown host capabilities force `PLAN_ONLY`.",
  "No objective gate forces `PLAN_ONLY` or `NO_GO`.",
  "Auth, payment, permission, deploy, publish, delete, secrets, or production work cannot enter `RUN_WITH_CONTRACT` by default.",
  "Never commit, push, deploy, mutate dependencies, edit `package.json`, edit lockfiles, or edit secrets as part of v0 loop execution; only `pnpm install --frozen-lockfile`, `npm ci`, and `bun install --frozen-lockfile` are allowed for dependency setup.",
  "If scope expands, stop and ask.",
];

function read(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
}

function numberedSteps(text) {
  return [...text.matchAll(/^\d+\.\s+(.+)$/gm)].map((match) => match[1]
    .replaceAll("Codex", "<host>")
    .replaceAll("Claude Code", "<host>")
    .trim());
}

export function validateWrapperParity(root = process.cwd()) {
  const codexPath = ".agents/skills/looppilot/SKILL.md";
  const claudePath = ".claude/skills/looppilot/SKILL.md";
  const commandPath = ".claude/commands/should-loop.md";
  const errors = [];
  const codex = read(root, codexPath);
  const claude = read(root, claudePath);
  const command = read(root, commandPath);

  if (!codex) errors.push(`${codexPath}: missing`);
  if (!claude) errors.push(`${claudePath}: missing`);

  for (const ref of requiredCoreRefs) {
    if (!codex.includes(ref)) errors.push(`${codexPath}: missing ${ref}`);
    if (!claude.includes(ref)) errors.push(`${claudePath}: missing ${ref}`);
  }

  for (const guardrail of guardrails) {
    if (!codex.includes(guardrail)) errors.push(`${codexPath}: missing guardrail ${guardrail}`);
    if (!claude.includes(guardrail)) errors.push(`${claudePath}: missing guardrail ${guardrail}`);
  }

  const codexSteps = numberedSteps(codex);
  const claudeSteps = numberedSteps(claude);
  if (JSON.stringify(codexSteps) !== JSON.stringify(claudeSteps)) {
    errors.push("wrapper workflow parity: Codex and Claude workflow steps differ beyond host wording");
  }

  if (!codex.includes('"host": "codex"')) errors.push(`${codexPath}: missing codex host profile`);
  if (!claude.includes('"host": "claude_code"')) errors.push(`${claudePath}: missing claude_code host profile`);

  if (!command.includes(".claude/skills/looppilot/SKILL.md")) errors.push(`${commandPath}: must reference Claude skill`);
  for (const forbidden of ["Risk Keywords", "Hard Defaults", "Two-Condition Test", "payment, billing", "支付、账单"]) {
    if (command.includes(forbidden)) errors.push(`${commandPath}: must not duplicate core rule content (${forbidden})`);
  }

  return { errors, workflowSteps: codexSteps.length, guardrails: guardrails.length };
}

const isCli = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isCli) {
  const result = validateWrapperParity();
  if (result.errors.length > 0) {
    console.error("LoopPilot wrapper parity validation failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("LoopPilot wrapper parity validation passed.");
  console.log(`Workflow steps: ${result.workflowSteps}`);
  console.log(`Guardrails checked: ${result.guardrails}`);
}
