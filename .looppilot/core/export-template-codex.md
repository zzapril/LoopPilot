# Run This LoopPilot Task In Codex

This file is a handoff prompt, not controlled execution. Codex must re-run the LoopPilot decision flow before taking action.

## Required behavior

1. Read the shared LoopPilot core files:
   - `.looppilot/core/qualification-rules.md`
   - `.looppilot/core/decision-schema.json`
   - `.looppilot/core/contract-template.md`
2. Emit schema-valid JSON first.
3. If and only if the decision is `RUN_WITH_CONTRACT`, render the contract before action.
4. Ask for confirmation unless the user has already explicitly confirmed the contract.
5. Verify that `host_capabilities.supported_surfaces` contains the recommended surface and that `surface_config` matches it. Codex currently defaults to `goal`; unsupported `loop` or `routine` recommendations remain planning handoffs.
6. Satisfy every top-level `required_user_confirmation` before execution. Ask for `dependency_setup` only when `install_locked_dependencies` is declared; setup is limited to `pnpm install --frozen-lockfile`, `npm ci`, or `bun install --frozen-lockfile`.
7. Treat `loop` and `routine` sources as read-only. Never mutate external state without a separate, explicit approval outside the LoopPilot contract.
8. Do not commit, push, deploy, publish, mutate dependencies, edit `package.json`, edit lockfiles, edit secrets, or broaden scope without explicit user confirmation.
9. Stop on gate pass, max rounds, repeated failure, forbidden action need, scope expansion, or user interrupt.

## User task

Paste or describe the task here.
