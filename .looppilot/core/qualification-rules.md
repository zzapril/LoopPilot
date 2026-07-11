# LoopPilot Qualification Rules

LoopPilot decides whether the current task should run as a bounded agent loop. It does not execute the loop itself, and it does not replace Claude Code `/loop`.

Claude Code `/loop` answers: how do I run a prompt again later?

LoopPilot answers: should this task enter a loop at all?

## Output Order

1. Emit a JSON decision that validates against `.looppilot/core/decision-schema.json`.
2. Then explain the decision in normal language.
3. If the decision is `RUN_WITH_CONTRACT`, show the contract before any action.

## Decisions

- `NO_GO`: do not loop; provide a safer alternative.
- `PLAN_ONLY`: do not execute yet; provide a plan, risk summary, or task breakdown.
- `RUN_WITH_CONTRACT`: execute only after showing a bounded contract and getting user confirmation unless already explicit.

## Recommended Surfaces

Every JSON decision must include `recommended_surface`:

- `manual`: no agent execution should proceed; use human judgment, a safer manual workflow, or a read-only alternative.
- `plan`: produce a plan, risk summary, task breakdown, or candidate gate before execution.
- `goal`: use a bounded goal-style execution when the task has a local objective gate such as lint, tests, typecheck, or a reviewable file output.
- `loop`: use Claude Code `/loop` when the task is safe but mainly waits for external state changes such as CI, deploy status, PR review, issue updates, or queue state.
- `routine`: use a recurring routine only when cadence, source, permissions, report format, and stop conditions are explicit; otherwise return `PLAN_ONLY`.

LoopPilot must not implement `/loop`, a scheduler, a background runner, a queue, or automatic resume. It only recommends the right execution surface.

`RUN_WITH_CONTRACT` is allowed only when `host_capabilities.supported_surfaces` includes the recommended surface. When `loop` or `routine` is appropriate but unavailable or under-specified, return `PLAN_ONLY` while keeping that `recommended_surface`.

Surface contracts are intentionally distinct:

- `goal` may read, edit a small scope, run local gates, and perform explicitly confirmed lockfile-frozen dependency setup.
- `loop` is read-only external-state observation with a source, interval, terminal conditions, and bounded checks.
- `routine` is read-only recurring reporting with a source, cadence, timezone, access scope, report format, and bounded runs.
- If an external-state loop discovers code changes are needed, stop and create a new `goal` decision instead of editing inside the loop.

## Two-Condition Test

Return `RUN_WITH_CONTRACT` only when both conditions are true:

- Verification is objective enough: a command, file output, checklist, or clearly testable report can say pass/fail.
- Waste is bounded: scope, max rounds, and stop conditions prevent open-ended exploration.

If either condition fails, return `PLAN_ONLY` or `NO_GO`.

## Host Capability Gate

Before returning `RUN_WITH_CONTRACT`, the host profile must be known:

- `host` is `codex` or `claude_code`.
- `can_edit_files` is true when edits are needed.
- `can_run_commands` is true when a command gate is required.
- `has_approval_flow` is true when user confirmation or risky action controls matter.
- `supported_surfaces` lists the proven `goal`, `loop`, or `routine` host-native surfaces.
- `capability_confidence` is `known`.

If host capabilities are unknown, return `PLAN_ONLY`.

## Hard Defaults

| Signal | Default |
|---|---|
| no objective gate | `PLAN_ONLY` or `NO_GO` |
| broad goal such as "finish the project" | `NO_GO` |
| destructive action | `NO_GO` |
| production deploy or publish | `NO_GO` |
| auth/payment/permission code changes | `PLAN_ONLY` or `NO_GO` |
| dependency install | allow only explicitly confirmed lockfile-frozen setup (`pnpm install --frozen-lockfile`, `npm ci`, or `bun install --frozen-lockfile`); dependency mutation remains `PLAN_ONLY` |
| commit/push request | require explicit confirmation; v0 default no |
| external wait such as CI, deploy, PR review, or queue status | prefer `recommended_surface: "loop"` when otherwise safe; do not implement waiting inside LoopPilot |
| missing max rounds | ask once or default to 3 |
| unknown host capabilities | `PLAN_ONLY` |

## Risk Keywords

English:

```text
auth, payment, billing, checkout, permission, admin, production,
deploy, publish, delete, drop, migration, secret, token, credential
```

Chinese:

```text
支付、账单、结账、鉴权、权限、管理员、生产、上线、发布、
部署、删除、清空、迁移、数据库、密钥、凭证、token
```

## Clarification Rule

- Ask at most one clarifying question.
- Ask only when one answer can unlock a safe classification.
- If still unclear, return `PLAN_ONLY`.
- Never use clarification to override hard safety defaults.

## Contract Invariants

Decision-state fields must not contradict the selected mode:

- `clarifying_question` is non-empty only when `needs_clarification` is true; otherwise it is null.
- `RUN_WITH_CONTRACT` has null `safe_alternative` / `next_prompt` and empty `plan_outputs`.
- `PLAN_ONLY` has a non-empty `next_prompt`, at least one `plan_output`, and null `safe_alternative`.
- `NO_GO` has non-empty `safe_alternative` / `next_prompt`, empty `plan_outputs`, and no required execution confirmations.
- Text used as a reason, goal, path, gate, source, cadence, or report field must contain non-whitespace content.

Every `RUN_WITH_CONTRACT` contract must include:

- known host capabilities
- goal
- scope
- allowed actions
- forbidden actions
- objective gate
- stop conditions
- max rounds
- human confirmations
- surface configuration matching `recommended_surface`
- report fields

`stop_conditions` must include `gate_passes`, `max_rounds_reached`, `forbidden_action_needed`, and `user_interrupt`.

A command gate is one allowlisted local verifier command, not an action pipeline or arbitrary executable. Supported forms are package test/lint/typecheck/check/verify/validate scripts and recognized local static-analysis/test tools. It must not contain shell control operators, environment wrappers or assignments, arbitrary scripts, destructive filesystem commands, dependency installation, git mutation, release/publish scripts, network commands, external-state tools, or references to sensitive paths such as `.env`, `.npmrc`, `secrets/**`, `.ssh/**`, `.aws/**`, private keys, or credential configs.

Top-level `required_user_confirmation` is the pre-execution subset of contract `human_confirmations`; every top-level entry must also appear in the contract list.

Forbidden actions must include at least:

- edit secrets
- dependency mutation: `pnpm add`, package-specific `npm install xxx`, `pnpm update`, changes to `package.json`, or changes to lockfiles
- git commit
- git push
- deploy

Allowed dependency setup is limited to lockfile-frozen installs:

- `pnpm install --frozen-lockfile`
- `npm ci`
- `bun install --frozen-lockfile`

The contract must include `install_locked_dependencies`, `required_user_confirmation: ["dependency_setup"]`, and `human_confirmations: ["dependency_setup"]` before any of these commands may run. Do not include `dependency_setup` when locked dependency setup is not allowed. Lockfile-frozen setup may still execute lifecycle scripts, so confirmation must explicitly cover dependency setup.

External `loop` and `routine` decisions must include `external_access` in both top-level `required_user_confirmation` and contract `human_confirmations`, plus `mutate_external_state` in forbidden actions. They may not allow code edits, test/lint commands, dependency setup, deployment, or external mutations.

## File Policy

Default behavior is chat-first. Do not write `.looppilot/latest-contract.md`, `.looppilot/latest-report.md`, `.looppilot/latest-review-gate.md`, `.looppilot/VISION.md`, `.looppilot/STATE.md`, `.looppilot/RUN_LOG.md`, or export files unless the user explicitly asks to save or export.

Explicit export/save/doctor/issue-intake outputs must not follow project-internal symbolic-link path components or overwrite Agent Pack core, fixture, helper, skill, command, dependency manifest/lockfile, or sensitive files. Path ownership checks treat names such as `..reports` as normal in-project names rather than parent traversal, and protected path checks are case-insensitive. Save commands must not read sensitive source paths. File replacement must use a same-directory temporary file so failure does not expose a partial artifact or delete the displaced original when restoration fails.
