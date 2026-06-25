# LoopPilot Implementation Progress

Last updated: 2026-06-26

## Feature Progress

- [x] Shared core protocol: qualification rules, decision schema, contract template, and 45 decision fixtures.
- [x] Fixture validator and verification scripts.
- [x] Codex and Claude Code wrappers.
- [x] Install and doctor commands.
- [x] Final verification and push.

## Notes

- v0 is chat-first and agent-native.
- File writes are explicit-save only.
- `RUN_WITH_CONTRACT` requires known host capabilities, objective gate, bounded rounds, stop conditions, and forbidden actions.
