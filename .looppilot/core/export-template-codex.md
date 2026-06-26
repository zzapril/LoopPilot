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
5. Do not commit, push, deploy, publish, install dependencies, edit secrets, or broaden scope without explicit user confirmation.
6. Stop on gate pass, max rounds, repeated failure, forbidden action need, scope expansion, or user interrupt.

## User task

Paste or describe the task here.
