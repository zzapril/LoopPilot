# LoopPilot

LoopPilot is an agent-native loop qualification pack for Codex and Claude Code. It decides whether a task should run as a bounded loop, emits schema-valid JSON, renders a contract, and lets the current agent execute only when safe.

## Quickstart

For short, task-oriented setup and usage, see [LoopPilot Quickstart](docs/LoopPilot_Quickstart.md).

## Current Implementation Status

The implementation status document is kept as an internal/audit record: [LoopPilot Implementation Status and Plan v0.2](docs/LoopPilot_Implementation_Status_and_Plan_v0.2.md).

Implemented:

- Shared LoopPilot core rules, decision schema, contract template, and report/export templates.
- 45 decision fixtures: 15 `NO_GO`, 15 `PLAN_ONLY`, and 15 `RUN_WITH_CONTRACT`.
- Codex and Claude Code wrappers that reference the same shared core.
- Claude Code `should-loop` command alias that points to the Claude skill without duplicating rules.
- Validation scripts for fixtures, runtime JSON Schema checks, schema drift, wrapper references, wrapper parity, scan output, scan secret-safety, export templates, fixture coverage taxonomy, export command behavior, explicit save commands, and install/doctor integration.
- Optional read-only repo scan helper.
- Explicit export command for Codex, Claude Code, and GitHub issue handoffs.
- Explicit save commands for user-requested latest contract/report files.

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

Doctor checks installed Agent Pack files, fixtures, runtime JSON Schema compatibility, schema drift, wrapper references, and wrapper parity, then prints a per-check pass/fail report. Use `--json` for a machine-readable report, and add `--output <path>` to write that JSON to a file.

The JSON report includes these metadata fields:

- `commit`: the short Git commit for the checked project from `git rev-parse --short HEAD`, or `null` when unavailable.
- `package_name`: the LoopPilot package name from `package.json`.
- `package_version`: the LoopPilot package version from `package.json`.
- `fixture_total`: the total number of parsed decision fixtures.
- `fixture_counts`: parsed fixture counts by decision category.
- `wrapper_files`: wrapper files expected for the selected target.
- `core_files`: core Agent Pack files expected by doctor.
- `duration_ms`: doctor runtime in milliseconds.

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
```

Generated defaults:

```text
.looppilot/latest-contract.md
.looppilot/latest-report.md
```

## Validate This Repo

```bash
npm test
```

This validates the 45 decision fixtures and confirms that runtime JSON Schema checks, schema drift, wrappers, wrapper parity, scan helper output, scan secret-safety, export templates, fixture coverage taxonomy, export command behavior, explicit save commands, and install/doctor integration satisfy the current safety gates.
