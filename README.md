# LoopPilot

LoopPilot is an agent-native loop qualification pack for Codex and Claude Code. It decides whether a task should run as a bounded loop, emits schema-valid JSON, renders a contract, and lets the current agent execute only when safe.

## Quickstart

For short, task-oriented setup and usage, see [LoopPilot Quickstart](docs/LoopPilot_Quickstart.md).

For product, technical, release, and v2 planning docs in reading order, see [LoopPilot Docs](docs/README.md).

## Current Implementation Status

The implementation status document is kept as an internal/audit record: [LoopPilot Implementation Status and Plan v0.2](docs/LoopPilot_Implementation_Status_and_Plan_v0.2.md).

Implemented:

- Shared LoopPilot core rules, decision schema, contract template, report/export templates, and v1 manual artifact templates including review gates.
- 45 decision fixtures: 15 `NO_GO`, 15 `PLAN_ONLY`, and 15 `RUN_WITH_CONTRACT`.
- Codex and Claude Code wrappers that reference the same shared core.
- Claude Code `should-loop` command alias that points to the Claude skill without duplicating rules.
- Validation scripts for fixtures, runtime JSON Schema checks, schema drift, wrapper references, wrapper parity, scan output, scan secret-safety, export templates, manual artifact templates, review-gate template, fixture coverage taxonomy, export command behavior, explicit save commands, and install/doctor integration.
- Optional read-only repo scan helper.
- Optional read-only host capability evidence helper for advisory host facts.
- Explicit export command for Codex, Claude Code, and GitHub issue handoffs.
- Explicit save commands for user-requested latest contract/report/review-gate files and v1 manual artifacts.

Not implemented by design:

- No loop runner.
- No background daemon.
- No model provider registry.
- No scheduled loop platform.
- No automatic commit, push, deploy, publish, or dependency installation.

## Install In A Project

Until the package is published, install from this repository during development:

```bash
node scripts/looppilot.mjs install --target both --scope project
```

After human approval and npm publish, run the CLI with `npx` and choose the agent target and installation scope for your project:

```bash
npx @looppilot/cli install --target both --scope project
```

After publish, you can also install the package globally if you prefer a reusable local command:

```bash
npm install --global @looppilot/cli
looppilot install --target both --scope project
```

The published package name is `@looppilot/cli` and the first release-ready version is `0.1.0`. The package is intended to be publishable after release review, but it must not be published until the packaged contents have been reviewed and generated `.looppilot/exports/`, `.looppilot/latest-*`, `.looppilot/VISION.md`, `.looppilot/STATE.md`, and `.looppilot/RUN_LOG.md` files are confirmed absent.

The installer copies:

```text
.looppilot/core/
.looppilot/fixtures/
.looppilot/scripts/scan-summary.mjs
.looppilot/scripts/claude-project-summary.mjs
.looppilot/scripts/host-capability-summary.mjs
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

## Read-Only Host Capability Evidence

The host capability helper prints optional JSON evidence for the current agent:

```bash
node scripts/looppilot.mjs host-capabilities
```

The `host_capabilities` field is shaped to match the `host_capabilities` object in `.looppilot/core/decision-schema.json`. The helper is read-only and limits itself to safely available facts: current working directory, Git availability, package script names from `package.json`, and an allowlist of documented sandbox-indicator environment variables. It must not read secrets, private config contents, or arbitrary environment variables.

This helper is advisory evidence only. It must not override LoopPilot's unknown host capability guardrails: if any required host capability is unavailable or uncertain, wrappers must still set `capability_confidence` to `unknown` and return `PLAN_ONLY`.

## Read-Only Claude Project Summary

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

Latest contract/report/review-gate files are never written by default. Save them only when the user explicitly asks:

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

## v1 Manual Artifact Templates

LoopPilot includes v1 manual artifact templates for project vision, current state, run logs, and review gates. These are human-authored artifacts, not background runner state files, daemon checkpoints, scheduler inputs, automatic execution records, approval gates, deployment gates, release gates, or permission to merge/push/deploy. They are never written by default.

```text
.looppilot/core/vision-template.md
.looppilot/core/state-template.md
.looppilot/core/run-log-template.md
.looppilot/core/review-gate-template.md
```

Save manual artifacts only when explicitly requested:

```bash
node scripts/looppilot.mjs save-vision --from /path/to/vision.md
node scripts/looppilot.mjs save-state --from /path/to/state.md
node scripts/looppilot.mjs save-run-log --from /path/to/run-log.md
node scripts/looppilot.mjs save-review-gate --from /path/to/review-gate.md
```

Generated defaults:

```text
.looppilot/VISION.md
.looppilot/STATE.md
.looppilot/RUN_LOG.md
.looppilot/latest-review-gate.md
```

All explicit save commands use duplicate protection, support `--force` to overwrite, and support `--dry-run` to preview without writing.

## Validate This Repo

```bash
npm test
```

This validates the 45 decision fixtures and confirms that runtime JSON Schema checks, Ajv cross-checks, schema drift, wrappers, wrapper parity, scan helper output, scan secret-safety, host capability helper shape and secret-safety, Claude project summary secret-safety, export templates, manual artifact templates, review-gate template, fixture coverage taxonomy, export command behavior, explicit save commands, package contents, docs consistency, CLI argument handling, and install/doctor integration satisfy the current safety gates.

## Optional Wrapper Output Parity Eval

The release checklist can run a non-default wrapper output parity eval when Codex-wrapper and Claude-wrapper outputs are deterministic or have been captured as goldens:

```bash
npm run eval:wrapper-parity
```

The eval uses `evals/wrapper-parity/fixtures.jsonl` and loads golden wrapper outputs from `evals/wrapper-parity/goldens/codex.jsonl` and `evals/wrapper-parity/goldens/claude.jsonl` by default. To compare freshly generated provider outputs, set `LOOPPILOT_CODEX_OUTPUTS` and `LOOPPILOT_CLAUDE_OUTPUTS` to JSONL files with matching fixture `id` values.

This is an optional release/eval gate, not a v0 runtime dependency and not part of `npm test`. It normalizes each wrapper output down to safety-critical fields only: `decision`, `confidence`, `needs_clarification`, `contract.gate`, `contract.stop_conditions`, and `contract.forbidden_actions`. The eval fails if those normalized fields diverge between wrappers.
