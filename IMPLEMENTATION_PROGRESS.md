# LoopPilot Implementation Progress

Last updated: 2026-06-28

## Feature Progress

- [x] Shared core protocol: qualification rules, decision schema, contract template, and 45 decision fixtures.
- [x] Fixture validator and verification scripts.
- [x] Codex and Claude Code wrappers.
- [x] Install and enhanced doctor commands with per-check pass/fail output.
- [x] Runtime JSON Schema, Ajv cross-check, schema drift validation, and safety negative probes for fixture decisions and schema enums.
- [x] Wrapper parity validation for Codex and Claude Code guardrails/workflow.
- [x] Fixture coverage report for decision distribution, high-risk keyword coverage, and taxonomy coverage.
- [x] Optional read-only repo scan helper with sensitive path reporting and no secret content reads.
- [x] Optional read-only host capability and Claude project summary helpers.
- [x] Agent-native GitHub issue URL intake for Claude Code and Codex, backed by read-only `.looppilot/scripts/issue-intake.mjs` and debug `looppilot issue-intake`.
- [x] Explicit export fallback templates and `looppilot export` command.
- [x] Export command integration validation for all targets, dry-run, explicit output, duplicate protection, and force overwrite.
- [x] Report and review-gate templates plus explicit `save-contract`, `save-report`, and `save-review-gate` commands for user-requested latest files.
- [x] Package contents and docs consistency validation, including local packed-tarball install smoke checks.
- [x] CLI argument validation including top-level help and command-specific unsupported/no-op option rejection.
- [x] GitHub Actions CI configured to mirror the local release gate on push and pull requests.
- [x] `0.2.1` UX simplification candidate: default install/doctor path, beginner-friendly help, and `help advanced` for helper/debug commands.

## v1 Manual Artifact Progress

- [x] Added manual artifact templates for vision, state, and run logs under `.looppilot/core/`.
- [x] Marked each manual artifact template as not being a background runner state file, daemon checkpoint, scheduler input, or automatic execution record.
- [x] Added explicit `save-vision`, `save-state`, and `save-run-log` commands with uppercase defaults: `.looppilot/VISION.md`, `.looppilot/STATE.md`, and `.looppilot/RUN_LOG.md`.
- [x] Kept `save-review-gate` default at `.looppilot/latest-review-gate.md`.
- [x] All `save-*` commands require `--from`, use duplicate protection by default, support `--force`, and support `--dry-run`.
- [x] Added manual template validation and expanded save-command validation for v1 artifacts.

- [x] Install/doctor integration validation in a temporary project.
- [x] `0.1.0` published to npm as `@looppilot/cli`.
- [x] `0.2.0` published to npm with GitHub issue intake.
- [x] `0.2.1` release candidate prepared locally for simpler install/help UX; not published without separate approval.
- [x] Final local verification, GitHub Actions CI, registry verification, npx install/doctor, and Claude Code smoke test passed.

## Notes

- v0 remains chat-first and agent-native.
- v0.2 issue intake remains agent-native: users paste issue URLs into Claude Code or Codex, while LoopPilot only reads and packages a single issue as untrusted context.
- `context-summary`, issue comments expansion, and linked PR intake remain future work rather than part of the `0.2.1` simplification batch.
- File writes are explicit-save or explicit-export only; v1 manual artifacts are not automatic runner state.
- `RUN_WITH_CONTRACT` requires known host capabilities, objective gate, bounded rounds, stop conditions, and forbidden actions.
- LoopPilot still does not implement a runner, provider registry, scheduler, GitHub issue queue, deployer, or automatic commit/push flow.
