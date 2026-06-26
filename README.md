# LoopPilot

LoopPilot is an agent-native loop qualification pack for Codex and Claude Code. It decides whether a task should run as a bounded loop, emits schema-valid JSON, renders a contract, and lets the current agent execute only when safe.

## Quickstart

For short, task-oriented setup and usage, see [LoopPilot Quickstart](docs/LoopPilot_Quickstart.md).

## Current Implementation Status

The implementation status document is kept as an internal/audit record: [LoopPilot Implementation Status and Plan v0.2](docs/LoopPilot_Implementation_Status_and_Plan_v0.2.md).

Implemented:

- Shared LoopPilot core rules, decision schema, contract template, report/export templates, and v1 manual artifact templates.
- 45 decision fixtures: 15 `NO_GO`, 15 `PLAN_ONLY`, and 15 `RUN_WITH_CONTRACT`.
- Codex and Claude Code wrappers that reference the same shared core.
- Claude Code `should-loop` command alias that points to the Claude skill without duplicating rules.
- Validation scripts for fixtures, runtime JSON Schema checks, schema drift, wrapper references, wrapper parity, scan output, scan secret-safety, export templates, manual artifact templates, fixture coverage taxonomy, export command behavior, explicit save commands, and install/doctor integration.
- Optional read-only repo scan helper.
- Explicit export command for Codex, Claude Code, and GitHub issue handoffs.
- Explicit save commands for user-requested latest contract/report files and v1 manual artifacts.

Not implemented by design:

- No loop runner.
- No background daemon.
- No model provider registry.
- No scheduled loop platform.
- No automatic commit, push, deploy, publish, or dependency installation.

## Install In A Project

For published package usage, run the CLI with `npx` and choose the agent target and installation scope for your project:

```bash
npx @looppilot/cli install --target both --scope project
```

You can also install the package globally if you prefer a reusable local command:

```bash
npm install --global @looppilot/cli
looppilot install --target both --scope project
```

The published package name is `@looppilot/cli`. The package is intended to be publishable after release review, but it must not be published until the packaged contents have been reviewed and generated `.looppilot/exports/` files or `.looppilot/latest-*` files are confirmed absent.

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

The JSON report includes a `metadata` object with:

- CLI package name/version and decision schema `$id`.
- Target, project path, timestamp, current git commit when available, and doctor runtime.
- Fixture totals/counts, expected wrapper/core file lists, installed/missing file counts, and SHA-256 hashes for installed pack files.

## Read-Only Repo Scan

The scan helper prints optional evidence for the current agent. It is read-only and does not execute a loop:

```bash
node scripts/looppilot.mjs scan
```

The scan reports dirty state, changed paths, candidate commands, risk paths, and sensitive path candidates such as `.env`. It does not read secret file contents.

A separate Claude Code project summary helper reports only optional metadata from documented project-level Claude Code files. It checks for the LoopPilot Claude wrapper, command alias, and whether `.claude/settings.json` or `.claude/settings.local.json` contain top-level `permissions` or `hooks` objects. It does not output permission rules, hook commands, environment values, or other settings content:

```bash
node scripts/looppilot.mjs claude-project-summary
```

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

## v1 Manual Artifact Templates

LoopPilot includes v1 manual artifact templates for project vision, current state, and run logs. These are human-authored artifacts, not background runner state files, daemon checkpoints, scheduler inputs, or automatic execution records. They are never written by default.

```text
.looppilot/core/vision-template.md
.looppilot/core/state-template.md
.looppilot/core/run-log-template.md
```

Save manual artifacts only when explicitly requested:

```bash
node scripts/looppilot.mjs save-vision --from /path/to/vision.md
node scripts/looppilot.mjs save-state --from /path/to/state.md
node scripts/looppilot.mjs save-run-log --from /path/to/run-log.md
```

Generated defaults:

```text
.looppilot/vision.md
.looppilot/state.md
.looppilot/run-log.md
```

All explicit save commands use duplicate protection, support `--force` to overwrite, and support `--dry-run` to preview without writing.

## Validate This Repo

```bash
npm test
```

This validates the 45 decision fixtures and confirms that runtime JSON Schema checks, schema drift, wrappers, wrapper parity, scan helper output, scan secret-safety, export templates, manual artifact templates, fixture coverage taxonomy, export command behavior, explicit save commands, and install/doctor integration satisfy the current safety gates.

## Optional Wrapper Output Parity Eval

The release checklist can run a non-default wrapper output parity eval when Codex-wrapper and Claude-wrapper outputs are deterministic or have been captured as goldens:

```bash
npm run eval:wrapper-parity
```

The eval uses `evals/wrapper-parity/fixtures.jsonl` and loads golden wrapper outputs from `evals/wrapper-parity/goldens/codex.jsonl` and `evals/wrapper-parity/goldens/claude.jsonl` by default. To compare freshly generated provider outputs, set `LOOPPILOT_CODEX_OUTPUTS` and `LOOPPILOT_CLAUDE_OUTPUTS` to JSONL files with matching fixture `id` values.

This is an optional release/eval gate, not a v0 runtime dependency and not part of `npm test`. It normalizes each wrapper output down to safety-critical fields only: `decision`, `confidence`, `needs_clarification`, `contract.gate`, `contract.stop_conditions`, and `contract.forbidden_actions`. The eval fails if those normalized fields diverge between wrappers.
