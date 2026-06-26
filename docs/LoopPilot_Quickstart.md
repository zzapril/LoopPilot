# LoopPilot Quickstart

Short, task-oriented setup for using LoopPilot as an agent-native loop qualification pack.

## 1. Install from this repo

From a project where you want the Agent Pack installed, run:

```bash
node /path/to/LoopPilot/scripts/looppilot.mjs install --target both --scope project
```

When developing inside this repository, run:

```bash
node scripts/looppilot.mjs install --target both --scope project
```

## 2. Run doctor

Verify the installed Codex and Claude Code files:

```bash
node scripts/looppilot.mjs doctor --target both
```

## 3. Use the Codex skill

In Codex, ask to use the LoopPilot skill for a candidate loop task. The skill decides whether the task is `NO_GO`, `PLAN_ONLY`, or `RUN_WITH_CONTRACT` before any loop-like execution.

Example:

```text
Use the LoopPilot skill to decide whether this task should run as a bounded loop: fix lint errors until npm test passes.
```

## 4. Use the Claude command alias

In Claude Code, use the command alias:

```text
/should-loop fix lint errors until npm test passes
```

The alias delegates to the Claude LoopPilot skill; it does not duplicate the shared rules.

## 5. Run scan

Generate optional read-only evidence for the current agent:

```bash
node scripts/looppilot.mjs scan
```

## 6. Export handoff

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
- No default file writes for latest contracts or reports.
- No automatic commit, push, deploy, publish, or dependency installation.

Save latest contract/report files only when explicitly requested with `save-contract` or `save-report`.
