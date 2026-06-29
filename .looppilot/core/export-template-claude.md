# Run This LoopPilot Task In Claude Code

This file is a handoff prompt, not controlled execution. Claude Code must re-run the LoopPilot decision flow before taking action.

## Required behavior

1. Use the project skill at `.claude/skills/looppilot/SKILL.md`.
2. Read the shared LoopPilot core files:
   - `.looppilot/core/qualification-rules.md`
   - `.looppilot/core/decision-schema.json`
   - `.looppilot/core/contract-template.md`
3. Emit schema-valid JSON first.
4. If and only if the decision is `RUN_WITH_CONTRACT`, render the contract before action.
5. Ask for confirmation unless the user has already explicitly confirmed the contract.
6. Do not commit, push, deploy, publish, mutate dependencies, edit `package.json`, edit lockfiles, edit secrets, or broaden scope without explicit user confirmation; dependency setup is limited to `pnpm install --frozen-lockfile`, `npm ci`, or `bun install --frozen-lockfile`.

## User task

Paste or describe the task here.
