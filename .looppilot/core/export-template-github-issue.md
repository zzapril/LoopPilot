# LoopPilot Handoff Issue

This issue is a handoff, not controlled execution. Any agent or human picking it up must re-run LoopPilot qualification before making changes.

## Required safety checks

- Read `.looppilot/core/qualification-rules.md`, `.looppilot/core/decision-schema.json`, and `.looppilot/core/contract-template.md`.
- Emit schema-valid JSON first.
- Do not execute unless the decision is `RUN_WITH_CONTRACT` and a contract has been shown.
- Verify `host_capabilities.supported_surfaces` contains the recommendation and `surface_config` matches it; otherwise keep the handoff at `PLAN_ONLY`.
- Satisfy every top-level `required_user_confirmation` before execution. Ask for `dependency_setup` only when `install_locked_dependencies` is declared; setup is limited to `pnpm install --frozen-lockfile`, `npm ci`, or `bun install --frozen-lockfile`.
- Treat `loop` and `routine` sources as read-only and do not mutate external state.
- Do not commit, push, deploy, publish, mutate dependencies, edit `package.json`, edit lockfiles, edit secrets, delete files, or broaden scope without explicit human confirmation.
- Stop on gate pass, max rounds, repeated failure, forbidden action need, scope expansion, or human interrupt.

## Task

Describe the task here.

## Candidate gate

Add the objective command, checklist, file output, or report review gate here.
