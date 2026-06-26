# LoopPilot Implementation Progress

Last updated: 2026-06-26

## Feature Progress

- [x] Shared core protocol: qualification rules, decision schema, contract template, and 45 decision fixtures.
- [x] Fixture validator and verification scripts.
- [x] Codex and Claude Code wrappers.
- [x] Install and enhanced doctor commands with per-check pass/fail output.
- [x] Runtime JSON Schema and schema drift validation for fixture decisions and schema enums.
- [x] Wrapper parity validation for Codex and Claude Code guardrails/workflow.
- [x] Fixture coverage report for decision distribution, high-risk keyword coverage, and taxonomy coverage.
- [x] Optional read-only repo scan helper with sensitive path reporting and no secret content reads.
- [x] Explicit export fallback templates and `looppilot export` command.
- [x] Export command integration validation for all targets, dry-run, explicit output, duplicate protection, and force overwrite.
- [x] Report template and explicit `save-contract` / `save-report` commands for user-requested latest files.
- [x] Install/doctor integration validation in a temporary project.
- [x] Final local verification.

## Notes

- v0 remains chat-first and agent-native.
- File writes are explicit-save or explicit-export only.
- `RUN_WITH_CONTRACT` requires known host capabilities, objective gate, bounded rounds, stop conditions, and forbidden actions.
- LoopPilot still does not implement a runner, provider registry, scheduler, deployer, or automatic commit/push flow.
