# LoopPilot Contract Template

Render this contract before a `RUN_WITH_CONTRACT` task starts. The current agent must not take action until the contract is visible and confirmation is satisfied.

## Decision JSON

```json
{
  "decision": "RUN_WITH_CONTRACT",
  "recommended_surface": "goal",
  "confidence": "high",
  "needs_clarification": false,
  "clarifying_question": null,
  "host_capabilities": {
    "host": "codex",
    "can_edit_files": true,
    "can_run_commands": true,
    "has_approval_flow": true,
    "supports_skills_or_commands": true,
    "supported_surfaces": ["goal"],
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
    "forbidden_actions": ["edit_secrets", "mutate_dependencies", "git_commit", "git_push", "deploy"],
    "surface_config": {
      "type": "goal"
    },
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
      "supported_surfaces": ["goal"],
      "capability_confidence": "known"
    },
    "human_confirmations": ["large_diff", "config_change"],
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

Surface:
- `goal`: run a bounded local gate in the current session.
- `loop`: hand off read-only external-state checks to a proven host-native loop with an interval and terminal conditions.
- `routine`: hand off read-only recurring reports to a proven host-native routine with source, cadence, timezone, access scope, and report format.

Allowed:
- Read relevant files.
- Make small scoped edits.
- Run the declared gate command.
- After explicit `dependency_setup` confirmation, run only these lockfile-frozen commands when declared by the contract: `pnpm install --frozen-lockfile`, `npm ci`, or `bun install --frozen-lockfile`.
- For `loop` and `routine`, read external state/source and create reports only; do not edit code or mutate external state.

Confirmation behavior:
- Top-level `required_user_confirmation` lists approvals required before execution starts.
- Contract `human_confirmations` lists conditional gates to ask for only if that action is encountered.
- Every top-level required confirmation must also appear in contract `human_confirmations`.
- `dependency_setup` appears in both lists only when `install_locked_dependencies` is allowed.
- `external_access` appears in both lists for executable `loop` and `routine` contracts.

Forbidden:
- Read or edit secrets.
- Change auth/payment/permission logic unless explicitly scoped and confirmed.
- Mutate dependencies with `pnpm add`, package-specific `npm install xxx`, `pnpm update`, changes to `package.json`, or changes to lockfiles.
- Commit, push, deploy, or publish.

Gate:
- `<safe verification command or checklist>`
- Command gates use one allowlisted local verifier command only; no arbitrary scripts, environment wrappers, shell pipelines/control operators, dependency changes, git mutation, release actions, downloads, external-state tools, or sensitive path references.

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
