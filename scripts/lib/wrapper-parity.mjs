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
  "Local lint, test, typecheck, and file-output gates usually recommend `goal`.",
  "Safe tasks waiting on external state such as CI, deploy status, PR review, issue updates, or queue status usually recommend `loop`.",
  "Recurring work usually recommends `routine`, but remains `PLAN_ONLY` until cadence, source, permissions, report format, and stop conditions are explicit.",
  "Auth, payment, permission, deploy, publish, delete, secrets, or production work cannot enter `RUN_WITH_CONTRACT` by default.",
  "Do not implement Claude Code `/loop`, a scheduler, background runner, queue, or automatic resume inside LoopPilot.",
  "Never commit, push, deploy, mutate dependencies, edit `package.json`, edit lockfiles, or edit secrets as part of loop execution; only explicitly confirmed `pnpm install --frozen-lockfile`, `npm ci`, and `bun install --frozen-lockfile` are allowed for declared dependency setup.",
  "`loop` and `routine` contracts are read-only: they may inspect external state/source and report, but may not edit code or mutate external state.",
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
