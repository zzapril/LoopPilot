# LoopPilot Qualification Rules

LoopPilot decides whether the current task should run as a bounded agent loop. It does not execute the loop itself.

## Output Order

1. Emit a JSON decision that validates against `.looppilot/core/decision-schema.json`.
2. Then explain the decision in normal language.
3. If the decision is `RUN_WITH_CONTRACT`, show the contract before any action.

## Decisions

- `NO_GO`: do not loop; provide a safer alternative.
- `PLAN_ONLY`: do not execute yet; provide a plan, risk summary, or task breakdown.
- `RUN_WITH_CONTRACT`: execute only after showing a bounded contract and getting user confirmation unless already explicit.

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
| dependency install | `PLAN_ONLY` unless explicitly confirmed |
| commit/push request | require explicit confirmation; v0 default no |
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
- report fields

Forbidden actions must include at least:

- edit secrets
- install dependencies without confirmation
- git commit
- git push
- deploy

## File Policy

Default behavior is chat-first. Do not write `.looppilot/latest-contract.md`, `.looppilot/latest-report.md`, or export files unless the user explicitly asks to save or export.
