# LoopPilot Docs

This directory contains product, technical, release, and future-planning notes. Read them in this order when reviewing the project:

1. `LoopPilot_Quickstart.md` - shortest path for installing and using the Agent Pack.
2. `LoopPilot_PRD_v0.2.md` - product scope and non-goals.
3. `LoopPilot_Technical_Design_v0.2.md` - implementation shape and safety boundaries.
4. `LoopPilot_Reusable_Artifacts_v1.md` - optional manual artifacts: `VISION.md`, `STATE.md`, `RUN_LOG.md`, and review-gate evidence.
5. `release-checklist.md` and `release-notes-*.md` - published release records plus the `0.4.0` release-candidate migration notes.
6. `LoopPilot_Implementation_Status_and_Plan_v0.2.md` - audit log of what is implemented and verified.
7. `launch-notes.md` - short external positioning copy for explaining LoopPilot as a stopping-boundary tool.

The v2 orchestration documents now authorize only the narrow agent-native single issue intake implemented for `0.2.0`. The `0.2.1` through `0.2.4` line simplifies the user-facing install/help path, tightens dependency mutation guardrails, and scopes issue-intake tokens to the official GitHub API without adding a runner, provider registry, GitHub queue, scheduler, hooks integration, automatic resume, or `looppilot run`.

The `0.3.0` positioning layer is Claude Code `/loop` awareness: LoopPilot recommends whether a task should use `manual`, `plan`, `goal`, `loop`, or `routine`, while still leaving execution to the current agent surface.

The `0.4.0` release candidate makes those recommendations executable contracts: hosts declare `supported_surfaces`, every contract supplies matching `surface_config`, external `loop`/`routine` inputs are read-only, and locked dependency setup requires explicit `dependency_setup` confirmation. It also hardens install preflight/rollback, scan status reporting, issue URL validation, and standalone schema validation. The latest published npm version remains `0.3.0` until the release checklist is completed.

Current release-ready surface:

- One-command Codex and Claude Code Agent Pack install plus doctor helpers.
- Read-only `scan`, `host-capabilities`, and `claude-project-summary` helpers.
- Agent-native GitHub issue URL intake with read-only single issue helper.
- Explicit handoff `export` commands.
- Explicit `save-*` commands for user-requested durable files.

Default behavior remains chat-first: no generated latest files, no generated v1 artifacts, no automatic commit/push/deploy/publish, and no background execution.

For product positioning, see the README and PRD sections comparing LoopPilot with GitHub Copilot coding agent, OpenHands-style issue resolvers, and SWE-agent-style autonomous issue fixers. LoopPilot borrows auditability ideas, but it does not become an automatic issue-fixing agent.
