---
name: "looppilot"
description: "Decide whether a coding task should run as a bounded loop, render a LoopPilot contract, and execute only inside the current Codex session when safe."
---

# LoopPilot for Codex

Use this skill when the user asks whether a task can loop, asks to keep working until a gate passes, or asks for a safe agent loop.

## Required Core Files

Before making a decision, use the shared LoopPilot core:

- `.looppilot/core/qualification-rules.md`
- `.looppilot/core/decision-schema.json`
- `.looppilot/core/contract-template.md`

Do not duplicate or reinterpret the qualification rules in this wrapper. The shared core is the source of truth.

## Codex Host Profile

Use this host profile unless the current session proves otherwise:

```json
{
  "host": "codex",
  "can_edit_files": true,
  "can_run_commands": true,
  "has_approval_flow": true,
  "supports_skills_or_commands": true,
  "capability_confidence": "known"
}
```

If any capability is unavailable or uncertain, set `capability_confidence` to `unknown` and return `PLAN_ONLY`.

## Workflow

1. Read the user's goal and current session context.
2. Optionally use scan evidence if the user provided it; do not require scan evidence.
3. Apply `.looppilot/core/qualification-rules.md`.
4. Ask at most one clarifying question if it can unlock a safe classification.
5. Emit a JSON decision that validates against `.looppilot/core/decision-schema.json`.
6. Then explain the decision in normal language.
7. For `RUN_WITH_CONTRACT`, render the contract using `.looppilot/core/contract-template.md`.
8. Ask for confirmation unless the user already explicitly confirmed.
9. Execute in the current Codex session only within the contract.
10. Do not write `.looppilot/latest-contract.md`, `.looppilot/latest-report.md`, `.looppilot/latest-review-gate.md`, `.looppilot/VISION.md`, `.looppilot/STATE.md`, `.looppilot/RUN_LOG.md`, or export files unless the user explicitly asks to save or export.

## Decision Guardrails

- Unknown host capabilities force `PLAN_ONLY`.
- No objective gate forces `PLAN_ONLY` or `NO_GO`.
- Auth, payment, permission, deploy, publish, delete, secrets, or production work cannot enter `RUN_WITH_CONTRACT` by default.
- Never commit, push, deploy, install dependencies, or edit secrets as part of v0 loop execution.
- If scope expands, stop and ask.
