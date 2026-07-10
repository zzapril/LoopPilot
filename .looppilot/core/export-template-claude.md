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
6. Verify that `host_capabilities.supported_surfaces` contains the recommended surface and that `surface_config` matches it. Claude Code may use a supported `loop`; unsupported `routine` recommendations remain planning handoffs.
7. Satisfy every top-level `required_user_confirmation` before execution. Ask for `dependency_setup` only when `install_locked_dependencies` is declared; setup is limited to `pnpm install --frozen-lockfile`, `npm ci`, or `bun install --frozen-lockfile`.
8. Treat `loop` and `routine` sources as read-only. Never mutate external state without a separate, explicit approval outside the LoopPilot contract.
9. Do not commit, push, deploy, publish, mutate dependencies, edit `package.json`, edit lockfiles, edit secrets, or broaden scope without explicit user confirmation.

## User task

Paste or describe the task here.
