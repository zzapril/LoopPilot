# LoopPilot Handoff Issue

This issue is a handoff, not controlled execution. Any agent or human picking it up must re-run LoopPilot qualification before making changes.

## Required safety checks

- Read `.looppilot/core/qualification-rules.md`, `.looppilot/core/decision-schema.json`, and `.looppilot/core/contract-template.md`.
- Emit schema-valid JSON first.
- Do not execute unless the decision is `RUN_WITH_CONTRACT` and a contract has been shown.
- Do not commit, push, deploy, publish, mutate dependencies, edit `package.json`, edit lockfiles, edit secrets, delete files, or broaden scope without explicit human confirmation; dependency setup is limited to `pnpm install --frozen-lockfile`, `npm ci`, or `bun install --frozen-lockfile`.
- Stop on gate pass, max rounds, repeated failure, forbidden action need, scope expansion, or human interrupt.

## Task

Describe the task here.

## Candidate gate

Add the objective command, checklist, file output, or report review gate here.
