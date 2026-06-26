# LoopPilot

LoopPilot is an agent-native loop qualification pack for Codex and Claude Code. It decides whether a task should run as a bounded loop, emits schema-valid JSON, renders a contract, and lets the current agent execute only when safe.

## Current Implementation Status

Implemented:

- Shared LoopPilot core rules, decision schema, contract template, and report/export/review-gate templates.
- 45 decision fixtures: 15 `NO_GO`, 15 `PLAN_ONLY`, and 15 `RUN_WITH_CONTRACT`.
- Codex and Claude Code wrappers that reference the same shared core.
- Claude Code `should-loop` command alias that points to the Claude skill without duplicating rules.
- Validation scripts for fixtures, runtime JSON Schema checks, schema drift, wrapper references, wrapper parity, scan output, scan secret-safety, export templates, review-gate template, fixture coverage taxonomy, export command behavior, explicit save commands, and install/doctor integration.
- Optional read-only repo scan helper.
- Explicit export command for Codex, Claude Code, and GitHub issue handoffs.
- Explicit save commands for user-requested latest contract/report/review-gate files.

Not implemented by design:

- No loop runner.
- No background daemon.
- No model provider registry.
- No scheduled loop platform.
- No automatic commit, push, deploy, publish, or dependency installation.

## Install In A Project

From the LoopPilot package or repository:

```bash
npx @looppilot/cli install --target both --scope project
```

From this repository during development:

```bash
node scripts/looppilot.mjs install --target both --scope project
```

The installer copies:

```text
.looppilot/core/
.looppilot/fixtures/
.looppilot/scripts/scan-summary.mjs
.agents/skills/looppilot/SKILL.md
.claude/skills/looppilot/SKILL.md
.claude/commands/should-loop.md
```

It does not run loops, install providers, start daemons, commit, push, or deploy.

## Check Installation

```bash
node scripts/looppilot.mjs doctor --target both
```

Doctor checks installed Agent Pack files, fixtures, runtime JSON Schema compatibility, schema drift, wrapper references, and wrapper parity, then prints a per-check pass/fail report.

## Read-Only Repo Scan

The scan helper prints optional evidence for the current agent. It is read-only and does not execute a loop:

```bash
node scripts/looppilot.mjs scan
```

The scan reports dirty state, changed paths, candidate commands, risk paths, and sensitive path candidates such as `.env`. It does not read secret file contents.

## Explicit Export Fallback

Exports are handoff files only. They are not controlled execution, and the receiving agent must re-run the LoopPilot decision flow.

```bash
node scripts/looppilot.mjs export --target codex
node scripts/looppilot.mjs export --target claude
node scripts/looppilot.mjs export --target github-issue
```

Generated defaults:

```text
.looppilot/exports/RUN_IN_CODEX.md
.looppilot/exports/RUN_IN_CLAUDE.md
.looppilot/exports/github-issue.md
```

## Explicit Save Commands

Latest contract/report files are never written by default. Save them only when the user explicitly asks:

```bash
node scripts/looppilot.mjs save-contract --from /path/to/contract.md
node scripts/looppilot.mjs save-report --from /path/to/report.md
node scripts/looppilot.mjs save-review-gate --from /path/to/review-gate.md
```

Generated defaults:

```text
.looppilot/latest-contract.md
.looppilot/latest-report.md
.looppilot/latest-review-gate.md
```

## Manual Review Gates

Review gates are manual evidence artifacts created for human review after a LoopPilot contract attempt. They are not automatic approval gates, deployment gates, release gates, or permission to merge, push, deploy, or publish. Use the template at `.looppilot/core/review-gate-template.md`, then save it only when explicitly requested with `save-review-gate`.

## Validate This Repo

```bash
npm test
```

This validates the 45 decision fixtures and confirms that runtime JSON Schema checks, schema drift, wrappers, wrapper parity, scan helper output, scan secret-safety, export templates, review-gate template, fixture coverage taxonomy, export command behavior, explicit save commands, and install/doctor integration satisfy the current safety gates.
