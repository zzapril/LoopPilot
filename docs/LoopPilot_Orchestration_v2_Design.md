# LoopPilot Orchestration v2 Design

**Version**: v2 design draft  
**Date**: 2026-06-26  
**Status**: Draft for review; not approved for implementation  
**Scope**: Define the allowed orchestration surface for a future LoopPilot v2 without changing the v0/v0.2 rule that LoopPilot is not an autonomous runner.

---

## 1. Purpose

LoopPilot v2 may add lightweight orchestration around the existing agent-native loop qualification workflow. This document defines that boundary before any orchestration code is written.

The core product remains unchanged:

> LoopPilot decides whether a task should loop, produces a bounded loop contract when safe, and hands execution to a human-supervised agent session.

v2 orchestration is allowed to improve intake, reminders, and handoff. It is not allowed to turn LoopPilot into an autonomous deployment, merge, or unbounded execution system.

---

## 2. Non-negotiable boundaries

The following remain outside LoopPilot v2.

### 2.1 No autonomous deploy

LoopPilot must not deploy, release, publish, promote, or otherwise change production or external runtime state on its own.

Forbidden examples:

- Running production deploy commands.
- Publishing packages, images, extensions, or releases.
- Promoting staging to production.
- Applying infrastructure changes to live environments.
- Rotating production secrets or credentials.

Allowed alternative:

- Produce a deploy checklist or approval handoff for a human/operator to execute outside LoopPilot.

### 2.2 No automatic merge

LoopPilot must not merge pull requests or push changes into protected/shared branches automatically.

Forbidden examples:

- Clicking or invoking merge actions after checks pass.
- Auto-rebasing and force-pushing shared branches.
- Bypassing branch protection, required reviews, or code-owner rules.
- Treating a passing gate as approval to merge.

Allowed alternative:

- Prepare a human-readable review summary, risk notes, and suggested next action for an approver.

### 2.3 No unbounded execution

LoopPilot must not run indefinitely, retry without limits, or continue expanding scope after the original contract is exhausted.

Every executable loop must have all of the following before action starts:

- Explicit goal.
- Explicit in-scope files or work area.
- Explicit forbidden actions.
- Objective verification gate.
- Maximum rounds or time budget.
- Stop conditions.
- Human approval requirement for scope expansion.

Forbidden examples:

- “Keep going until everything is perfect.”
- “Monitor this forever and fix whatever appears.”
- “Keep opening new issues and solving them.”
- “Continue until no improvements remain.”

Allowed alternative:

- Run a bounded contract, stop, report status, and require a new human approval before any follow-up contract.

---

## 3. Allowed v2 integrations

v2 integrations are orchestration aids only. They may create structured inputs, reminders, and handoff artifacts, but they must not execute code changes, merge changes, or deploy systems without a human-supervised agent session and an approved contract.

### 3.1 GitHub issue intake

LoopPilot v2 may ingest GitHub issue content to create a loop qualification request.

Allowed behavior:

- Read issue title, body, labels, linked pull requests, and relevant comments.
- Convert issue text into a proposed LoopPilot decision request.
- Attach read-only repository context when available.
- Classify the request as `RUN_WITH_CONTRACT`, `PLAN_ONLY`, or `NO_GO` using the shared core rules.
- Produce a draft contract or safe alternative for human review.
- Post or save a draft response only when explicitly configured and approved.

Not allowed:

- Automatically claiming issues as executable work.
- Automatically editing code from issue intake alone.
- Automatically closing issues.
- Automatically opening pull requests unless a human-supervised agent session has executed an approved contract and the user explicitly asks for that output.
- Treating issue labels as sufficient permission to bypass risk checks.

Required gate:

- A human must approve the generated contract before execution begins.

### 3.2 Scheduled review reminder

LoopPilot v2 may remind a human to review a stale contract, pending decision, or completed report.

Allowed behavior:

- Send a scheduled reminder that a decision, contract, report, or pull request needs review.
- Include current status, last known gate result, risks, and requested human action.
- Stop after a configured number of reminders.

Not allowed:

- Starting a new execution loop because a reminder fired.
- Re-running tests or commands on a schedule without a human-supervised contract.
- Escalating from reminder to merge, deploy, or code edit.
- Creating an infinite notification loop.

Required gate:

- The reminder must ask for human action; it must not perform the action itself.

### 3.3 Manual approval handoff

LoopPilot v2 may create explicit handoff artifacts for a human approver.

Allowed behavior:

- Generate an approval checklist.
- Summarize scope, risks, files touched, verification gates, and stop conditions.
- Capture an approval decision as input to a subsequent human-supervised agent session.
- Record who/what approved the next bounded step when the host environment provides that information.

Not allowed:

- Inferring approval from silence.
- Treating a successful test run as approval.
- Treating issue assignment, label changes, or CI success as approval to merge/deploy.
- Expanding contract scope after approval without a new approval.

Required gate:

- Approval must be explicit, attributable when possible, and tied to a specific contract version.

---

## 4. Risk model

LoopPilot v2 must classify orchestration requests before code execution or integration action. Risk is determined by the requested action, target system, permission level, reversibility, and clarity of the verification gate.

### 4.1 Risk levels

| Level | Meaning | Default decision |
|---|---|---|
| Low | Read-only analysis, documentation, local-only changes with clear tests and narrow scope | May become `RUN_WITH_CONTRACT` |
| Medium | Code changes with bounded files, deterministic checks, and no privileged systems | May become `RUN_WITH_CONTRACT` after explicit contract approval |
| High | Auth, permissions, payments, data migrations, destructive operations, release processes, production-adjacent systems | Usually `PLAN_ONLY` or `NO_GO` |
| Critical | Production deploy, automatic merge, secret handling, irreversible data changes, unbounded execution | `NO_GO` for autonomous LoopPilot execution |

### 4.2 Risk factors

A request becomes higher risk when it includes any of the following:

- Production or customer-facing systems.
- Authentication, authorization, permissions, billing, or payments.
- Secrets, credentials, tokens, or key material.
- Data deletion, migration, schema changes, or irreversible transformation.
- Infrastructure, deployment, release, or package publishing.
- Branch protection, repository settings, or organization-level permissions.
- Ambiguous acceptance criteria.
- Broad file scope or unclear ownership.
- Requests to continue without a bounded stop condition.
- Requests to act from a GitHub issue, schedule, webhook, or other asynchronous trigger without human review.

### 4.3 Risk outcomes

- `RUN_WITH_CONTRACT`: Allowed only when risk is low or controlled medium, scope is bounded, and a deterministic gate exists.
- `PLAN_ONLY`: Used when the work may be valid but needs decomposition, clearer gates, or human review before execution.
- `NO_GO`: Used when the user asks LoopPilot to deploy, merge, run unbounded work, perform destructive actions, or bypass human approval.

### 4.4 Risk escalation rule

When an integration receives a low-risk request but execution reveals a higher-risk action, LoopPilot must stop and report. It must not silently upgrade permissions or continue under the old contract.

---

## 5. Permission model

LoopPilot v2 permissions are capability-scoped. A workflow receives only the minimum capability needed for the approved step.

### 5.1 Permission tiers

| Tier | Capability | Examples | Human approval required |
|---|---|---|---|
| Read | Read repository or issue context | Inspect files, read issue metadata, summarize status | Required for private sources according to host policy |
| Draft | Create local/draft artifacts | Draft decision, contract, checklist, reminder text | Required before publishing externally |
| Comment | Post non-executing status or review text | Post draft decision or reminder comment | Required by configuration or per action |
| Local execute | Run bounded local commands in an agent session | Tests, linters, local validation | Required through approved loop contract |
| Write branch | Edit files and commit/prepare PR in a branch | Code/documentation changes | Required through approved loop contract |
| Merge/deploy | Merge, release, deploy, publish, production changes | Protected branch merge, package publish, production deploy | Outside LoopPilot v2 autonomous scope |

### 5.2 Permission principles

- Deny by default.
- Ask before execution.
- Separate read permissions from write permissions.
- Separate branch write from merge permission.
- Separate local validation from production action.
- Bind approval to a contract version.
- Expire approvals after the contract stops.
- Require new approval for scope, risk, or permission escalation.
- Log or report decisions and stop reasons when the host supports it.

### 5.3 Integration permission constraints

GitHub issue intake may use read permissions to prepare a decision request, but it may not use issue access as write or execution permission.

Scheduled review reminders may use scheduling and notification permissions, but they may not use the scheduler as execution permission.

Manual approval handoff may record approval state, but approval is valid only for the named contract, scope, gate, and time/round budget.

---

## 6. Implementation sequencing

Before writing v2 orchestration code, the project must review and approve this design or a successor design that preserves the boundaries in this document.

Required order:

1. Review and approve the v2 orchestration design.
2. Update shared qualification rules and fixtures for the approved integration boundaries.
3. Add schema fields only if needed for issue intake, reminders, or approval handoff.
4. Implement read-only/draft behavior first.
5. Add tests for risk escalation, permission denial, and bounded stop behavior.
6. Only then consider human-supervised execution handoff improvements.

`looppilot run` must not be added until the design is reviewed and explicitly approved. Even after approval, any run-like command must preserve bounded contracts, human approval, and the no deploy/no automatic merge/no unbounded execution boundaries.

---

## 7. Review checklist

A v2 proposal is not ready if any answer below is “yes”:

- Can LoopPilot deploy or publish without a human performing the deploy outside LoopPilot?
- Can LoopPilot merge automatically after checks pass?
- Can a schedule, webhook, issue label, or CI signal start execution without human contract approval?
- Can execution continue without a maximum round/time budget?
- Can scope expand without a new approval?
- Can a reminder become an action?
- Can a high-risk request bypass `PLAN_ONLY` or `NO_GO` because it arrived through an integration?
- Can `looppilot run` be added before this design is approved?

If any answer is “yes,” the proposal violates the v2 boundary.
