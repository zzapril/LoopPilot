# LoopPilot Docs

This directory contains product, technical, release, and future-planning notes. Read them in this order when reviewing the project:

1. `LoopPilot_Quickstart.md` - shortest path for installing and using the Agent Pack.
2. `LoopPilot_PRD_v0.2.md` - product scope and non-goals.
3. `LoopPilot_Technical_Design_v0.2.md` - implementation shape and safety boundaries.
4. `LoopPilot_Reusable_Artifacts_v1.md` - optional manual artifacts: `VISION.md`, `STATE.md`, `RUN_LOG.md`, and review-gate evidence.
5. `release-checklist.md` and `release-notes-0.1.0.md` - published `0.1.0` release status and validation record.
6. `LoopPilot_Implementation_Status_and_Plan_v0.2.md` - audit log of what is implemented and verified.

The v2 orchestration documents are planning material only. They do not authorize a runner, provider registry, GitHub queue, scheduler, hooks integration, automatic resume, or `looppilot run`.

Current published surface:

- Codex and Claude Code Agent Pack install/doctor helpers.
- Read-only `scan`, `host-capabilities`, and `claude-project-summary` helpers.
- Explicit handoff `export` commands.
- Explicit `save-*` commands for user-requested durable files.

Default behavior remains chat-first: no generated latest files, no generated v1 artifacts, no automatic commit/push/deploy/publish, and no background execution.
