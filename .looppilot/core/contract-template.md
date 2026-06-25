# LoopPilot Contract Template

Render this contract before a `RUN_WITH_CONTRACT` task starts. The current agent must not take action until the contract is visible and confirmation is satisfied.

## Decision JSON

```json
{
  "decision": "RUN_WITH_CONTRACT",
  "confidence": "high",
  "needs_clarification": false,
  "clarifying_question": null,
  "host_capabilities": {
    "host": "codex",
    "can_edit_files": true,
    "can_run_commands": true,
    "has_approval_flow": true,
    "supports_skills_or_commands": true,
    "capability_confidence": "known"
  },
  "reasons": ["Objective gate and bounded scope are available."],
  "safe_alternative": null,
  "next_prompt": null,
  "plan_outputs": [],
  "required_user_confirmation": [],
  "contract": {
    "goal": "<single narrow goal>",
    "scope": {
      "include": ["<allowed paths or areas>"],
      "exclude": [".env", ".env.*", "secrets/**", "dist/**"]
    },
    "allowed_actions": ["read_files", "edit_small_scope", "run_test_command"],
    "forbidden_actions": ["edit_secrets", "install_dependencies", "git_commit", "git_push", "deploy"],
    "gate": {
      "type": "command",
      "command": "<safe verification command>",
      "expect": "exit_zero"
    },
    "stop_conditions": ["gate_passes", "max_rounds_reached", "same_failure_twice", "forbidden_action_needed", "user_interrupt"],
    "max_rounds": 3,
    "host_capabilities": {
      "host": "codex",
      "can_edit_files": true,
      "can_run_commands": true,
      "has_approval_flow": true,
      "supports_skills_or_commands": true,
      "capability_confidence": "known"
    },
    "human_confirmations": ["dependency_install", "large_diff", "config_change"],
    "report": ["what_changed", "commands_run", "gate_result", "risks_or_blockers", "next_steps"]
  }
}
```

## Human-Readable Contract

Decision: `RUN_WITH_CONTRACT`

Goal:
- `<single narrow goal>`

Scope:
- Include: `<allowed paths or areas>`
- Exclude: `.env`, `.env.*`, `secrets/**`, generated output, and unrelated code.

Allowed:
- Read relevant files.
- Make small scoped edits.
- Run the declared gate command.

Forbidden:
- Read or edit secrets.
- Change auth/payment/permission logic unless explicitly scoped and confirmed.
- Install dependencies without confirmation.
- Commit, push, deploy, or publish.

Gate:
- `<safe verification command or checklist>`

Stop:
- Gate passes.
- Max rounds reached.
- Same failure appears twice.
- A forbidden action is needed.
- User interrupts.

Report:
- What changed.
- Commands run.
- Gate result.
- Risks or blockers.
- Next steps.
