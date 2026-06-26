# LoopPilot Quickstart

Short, task-oriented setup for using LoopPilot as an agent-native loop qualification pack.

## 1. Install

From a project where you want the Agent Pack installed, the release-ready package interface is:

```bash
npx @looppilot/cli install --target both --scope project
```

The package is release-ready at `0.1.0`, but `npm publish` is intentionally not part of this step. During local development from this repository, run:

```bash
node scripts/looppilot.mjs install --target both --scope project
```

## 2. Run Doctor

Verify the installed Codex and Claude Code files:

```bash
node scripts/looppilot.mjs doctor --target both
node scripts/looppilot.mjs doctor --target both --json
```

Doctor checks installed files, fixture/schema compatibility, wrapper references, wrapper parity, and installed file hashes. It does not run a loop.

## 3. Use The Codex Skill

In Codex, ask to use the LoopPilot skill for a candidate loop task. The skill decides whether the task is `NO_GO`, `PLAN_ONLY`, or `RUN_WITH_CONTRACT` before any loop-like execution.

Example:

```text
Use the LoopPilot skill to decide whether this task should run as a bounded loop: fix lint errors until npm test passes.
```

## 4. Use The Claude Code Command

In Claude Code, use the command alias:

```text
/should-loop fix lint errors until npm test passes
```

The alias delegates to the Claude LoopPilot skill; it does not duplicate the shared rules.

## 5. Gather Read-Only Evidence

Generate optional read-only evidence for the current agent:

```bash
node scripts/looppilot.mjs scan
node scripts/looppilot.mjs host-capabilities
node scripts/looppilot.mjs claude-project-summary
```

These helpers only summarize safe project or host facts. They do not read secret contents, do not install dependencies, and must not override LoopPilot's unknown-host guardrails.

## 6. Save Explicit Artifacts

Save latest files only when explicitly requested by a human:

```bash
node scripts/looppilot.mjs save-contract --from /path/to/contract.md
node scripts/looppilot.mjs save-report --from /path/to/report.md
node scripts/looppilot.mjs save-review-gate --from /path/to/review-gate.md
node scripts/looppilot.mjs save-vision --from /path/to/vision.md
node scripts/looppilot.mjs save-state --from /path/to/state.md
node scripts/looppilot.mjs save-run-log --from /path/to/run-log.md
```

Default outputs:

```text
.looppilot/latest-contract.md
.looppilot/latest-report.md
.looppilot/latest-review-gate.md
.looppilot/VISION.md
.looppilot/STATE.md
.looppilot/RUN_LOG.md
```

All save commands require `--from`, use duplicate protection by default, support `--force`, and support `--dry-run`.

## 7. Export Handoff

Create an explicit handoff file for another surface:

```bash
node scripts/looppilot.mjs export --target codex
node scripts/looppilot.mjs export --target claude
node scripts/looppilot.mjs export --target github-issue
```

Exports are handoff files only. The receiving agent must run its own LoopPilot decision flow.

## Warnings

LoopPilot intentionally does **not** provide:

- No runner.
- No provider or provider registry.
- No default file writes for latest contracts, reports, review gates, vision, state, or run logs.
- No automatic commit, push, deploy, publish, or dependency installation.

Use `save-*` commands only when a human explicitly asks for durable files.
