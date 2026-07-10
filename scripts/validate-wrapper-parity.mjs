#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { evalWrapperParity } from "./eval-wrapper-parity.mjs";

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

function validateEvalParityGuardrails(root = process.cwd()) {
  const errors = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-parity-guardrails-"));
  const sourceDir = path.join(root, "evals", "wrapper-parity");
  try {
    // Published runtime packs do not ship source-repository eval goldens.
    // The local repository runs these mutation probes as part of npm test.
    if (!fs.existsSync(sourceDir)) return errors;
    fs.cpSync(sourceDir, tempDir, { recursive: true });
    const options = {
      evalDir: tempDir,
      fixtures: path.join(tempDir, "fixtures.jsonl"),
      codex: path.join(tempDir, "goldens", "codex.jsonl"),
      claude: path.join(tempDir, "goldens", "claude.jsonl"),
    };
    if (evalWrapperParity(root, options).errors.length > 0) {
      errors.push("wrapper parity baseline unexpectedly failed during guardrail probes");
      return errors;
    }

    fs.appendFileSync(options.codex, `${JSON.stringify({ id: "extra-output", output: {} })}\n`, "utf8");
    if (!evalWrapperParity(root, options).errors.some((error) => error.includes("extra Codex wrapper output"))) {
      errors.push("wrapper parity eval did not reject an extra golden output");
    }

    fs.copyFileSync(path.join(sourceDir, "goldens", "codex.jsonl"), options.codex);
    const fixtureLines = fs.readFileSync(options.fixtures, "utf8").trim().split(/\n/).map(JSON.parse);
    fixtureLines[0].parity_mode = "typo_mode";
    fs.writeFileSync(options.fixtures, `${fixtureLines.map(JSON.stringify).join("\n")}\n`, "utf8");
    if (!evalWrapperParity(root, options).errors.some((error) => error.includes("unsupported parity_mode"))) {
      errors.push("wrapper parity eval did not reject an unsupported parity mode");
    }

    fs.copyFileSync(path.join(sourceDir, "fixtures.jsonl"), options.fixtures);
    const duplicateFixture = fs.readFileSync(options.fixtures, "utf8").trim().split(/\n/)[0];
    fs.appendFileSync(options.fixtures, `${duplicateFixture}\n`, "utf8");
    if (!evalWrapperParity(root, options).errors.some((error) => error.includes("duplicate parity fixture id"))) {
      errors.push("wrapper parity eval did not reject a duplicate fixture id");
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return errors;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const result = validateWrapperParity();
  result.errors.push(...validateEvalParityGuardrails());
  if (result.errors.length > 0) {
    console.error("LoopPilot wrapper parity validation failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("LoopPilot wrapper parity validation passed.");
  console.log(`Workflow steps: ${result.workflowSteps}`);
  console.log(`Guardrails checked: ${result.guardrails}`);
}
