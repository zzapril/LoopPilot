# LoopPilot Reusable Artifacts v1

**Version**: v1  
**Date**: 2026-06-26  
**Status**: Design doc; no runner implementation in this phase.

## 1. Purpose

LoopPilot remains **chat-first by default**: the current host agent evaluates a task, renders a bounded contract, executes only when appropriate, and reports in the conversation. Reusable artifacts are optional project-local files that preserve intent, current state, and review history when a user explicitly asks for durable memory or handoff material.

This document defines three optional files under `.looppilot/`:

- `.looppilot/VISION.md` for stable project or loop intent.
- `.looppilot/STATE.md` for the current manual loop state.
- `.looppilot/RUN_LOG.md` for append-only audit notes about manually repeated loop rounds.

These files are **not** a background runner, queue, daemon, scheduler, or autonomous execution mechanism. They are documentation artifacts that make repeated manual work easier to resume and review.

## 2. Creation Policy

### 2.1 Default behavior

LoopPilot must not create or update `.looppilot/VISION.md`, `.looppilot/STATE.md`, `.looppilot/RUN_LOG.md`, or any other durable artifact by default. The default remains:

1. Evaluate the task in chat.
2. Render decision JSON and the human-readable contract in chat.
3. Execute only in the current agent session if the task qualifies and confirmation requirements are satisfied.
4. Report results in chat.

### 2.2 When files may be created

The reusable artifact files may be created only when the user explicitly requests a saved artifact, durable memory, resume file, run log, handoff file, or equivalent file write. Examples of sufficient user intent include:

- “Save this LoopPilot state in the repo.”
- “Create the `.looppilot` reusable artifacts for this loop.”
- “Write a run log so another session can continue.”
- “Persist the vision and current state.”

The files may also be updated when the user explicitly asks to continue using already-created LoopPilot artifacts. Even then, the agent must describe the intended writes before editing if the write scope is not obvious from the user request.

### 2.3 When files must not be created

Do not create or update these files when the user only asks to:

- Decide whether a task can loop.
- Render a contract.
- Run a single bounded loop in the current chat.
- Explain LoopPilot.
- Produce an example without asking to save it.

A user asking for a loop does not imply permission to persist files.

## 3. Artifact Schemas

The schemas below are Markdown schemas. They favor readability, diffability, and copy/paste handoff over strict machine execution. Field names should remain stable so future tools can parse them, but v1 does not require a parser or runner.

### 3.1 `.looppilot/VISION.md`

`VISION.md` captures stable intent that changes rarely. It answers why the loop exists and what durable boundaries should guide future manual rounds.

Required fields:

```markdown
# LoopPilot Vision

schema_version: 1
artifact: VISION
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
created_by: <agent-or-human>

## Purpose
<One or two paragraphs describing the durable goal.>

## Non-Goals
- <Explicitly out-of-scope outcome.>

## Success Criteria
- <Durable success condition.>

## Durable Scope
### Include
- <Paths, systems, or behaviors that may be considered.>

### Exclude
- <Paths, systems, or behaviors that remain out of scope.>

## Constraints
- <Safety, product, technical, or process constraint.>

## Review Expectations
- verifier_required: <true|false>
- reviewer_required: <true|false>
- review_notes: <Human-readable expectation for review.>
```

Guidance:

- Keep the purpose stable across runs.
- Do not store secrets, credentials, private tokens, or sensitive customer data.
- Do not encode commands that imply unattended execution.
- Link to the current contract or chat summary if helpful, but do not replace the contract.

### 3.2 `.looppilot/STATE.md`

`STATE.md` captures the current manual loop checkpoint. It is the first file a future session should read when the user asks to resume.

Required fields:

```markdown
# LoopPilot State

schema_version: 1
artifact: STATE
updated_at: <ISO-8601 timestamp>
updated_by: <agent-or-human>
status: <not_started|in_progress|blocked|gate_passed|stopped>

## Current Goal
<Single narrow goal for the current manual loop.>

## Active Contract Snapshot
- source: <chat|.looppilot/core/contract-template.md|other>
- decision: <RUN_WITH_CONTRACT|PLAN_ONLY|NO_GO>
- max_rounds: <integer|null>
- current_round: <integer>
- gate_type: <command|checklist|review|mixed>
- gate_command: <command or null>
- gate_expectation: <exit_zero|checklist_passes|review_approved|other>

## Scope
### Include
- <Allowed path or area.>

### Exclude
- <Forbidden path or area.>

## Allowed Actions
- <Action copied or derived from the active contract.>

## Forbidden Actions
- <Action copied or derived from the active contract.>

## Stop Conditions
- <Stop condition copied or derived from the active contract.>

## Verifier Gate
- required: <true|false>
- type: <command|checklist|review|mixed>
- command: <command or null>
- expected_result: <exit_zero|all_items_pass|approval_recorded|other>
- last_result: <not_run|pass|fail|blocked>
- last_run_at: <ISO-8601 timestamp|null>
- evidence: <short summary or link>

## Review Gate
- required: <true|false>
- reviewer: <human|current_agent|separate_agent|unspecified>
- status: <not_requested|pending|approved|changes_requested|waived>
- required_before: <next_round|final_report|merge|none>
- evidence: <short summary or link>

## Next Manual Step
<The next action a human should ask the current agent to perform.>

## Open Questions
- <Question or blocker.>
```

Guidance:

- Treat this as a checkpoint, not an instruction to run automatically.
- Update `current_round`, gate results, and review status only after the user requests persistence.
- If the active contract changes materially, record the new snapshot rather than silently relying on an older state.

### 3.3 `.looppilot/RUN_LOG.md`

`RUN_LOG.md` is an append-only log for manual loop rounds. It records what happened, which gate ran, and whether review was requested or satisfied.

Required structure:

```markdown
# LoopPilot Run Log

schema_version: 1
artifact: RUN_LOG
created_at: <ISO-8601 timestamp>

## Entries

### <ISO-8601 timestamp> — Round <n> — <status>
- actor: <agent-or-human>
- contract_source: <chat|path|link>
- goal: <single narrow goal>
- actions_taken:
  - <Brief action summary.>
- files_changed:
  - <path or none>
- verifier_gate:
  - required: <true|false>
  - type: <command|checklist|review|mixed>
  - command: <command or null>
  - result: <pass|fail|blocked|not_run>
  - evidence: <command output summary, checklist result, or link>
- review_gate:
  - required: <true|false>
  - reviewer: <human|current_agent|separate_agent|unspecified>
  - status: <not_requested|pending|approved|changes_requested|waived>
  - evidence: <summary or link>
- stop_reason: <gate_passes|max_rounds_reached|same_failure_twice|forbidden_action_needed|user_interrupt|manual_pause|other>
- next_step: <Recommended next manual prompt or action.>
```

Guidance:

- Append new entries; do not rewrite history except to fix obvious clerical mistakes.
- Keep evidence concise. Link to external logs or summarize command output rather than pasting large transcripts.
- Do not include secrets or sensitive data.

## 4. Verifier and Review Gates

LoopPilot v1 distinguishes two gate classes:

1. **Verifier gate**: objective or semi-objective evidence that the round met the contract’s acceptance condition.
2. **Review gate**: human or designated reviewer approval that the result is acceptable, safe, or ready for the next step.

### 4.1 Relation to `contract-template.md`

The existing `.looppilot/core/contract-template.md` already defines the runtime contract fields that matter for bounded execution:

- `gate.type`
- `gate.command`
- `gate.expect`
- `stop_conditions`
- `max_rounds`
- `human_confirmations`
- `report`

The reusable artifact fields do not replace those fields. They persist a readable snapshot of them and add review status that is useful across sessions.

Mapping:

| Reusable artifact field | Source or relation to contract template |
|---|---|
| `STATE.md` `Active Contract Snapshot.decision` | Mirrors the rendered decision JSON. |
| `STATE.md` `Active Contract Snapshot.max_rounds` | Mirrors `contract.max_rounds`. |
| `STATE.md` `Verifier Gate.type` | Mirrors or refines `contract.gate.type`. |
| `STATE.md` `Verifier Gate.command` | Mirrors `contract.gate.command` when the gate is command-based. |
| `STATE.md` `Verifier Gate.expected_result` | Mirrors `contract.gate.expect`. |
| `STATE.md` `Stop Conditions` | Mirrors `contract.stop_conditions`. |
| `STATE.md` `Review Gate.required` | Derived from `contract.human_confirmations`, user instructions, or risk level. |
| `RUN_LOG.md` `verifier_gate.result` | Records the observed result for a completed manual round. |
| `RUN_LOG.md` `review_gate.status` | Records whether the required review is pending, approved, waived, or requested changes. |

### 4.2 Verifier gate fields

Use verifier fields when a command, checklist, or inspection can determine whether the current round succeeded.

Minimum verifier gate fields:

- `required`: whether the contract requires verification before reporting success.
- `type`: `command`, `checklist`, `review`, or `mixed`.
- `command`: the exact command when applicable.
- `expected_result`: what passing means.
- `last_result` or `result`: the latest observed outcome.
- `evidence`: a concise pointer to the output or checklist result.

A verifier gate can pass without a review gate only when the contract and user instructions allow objective verification to be sufficient.

### 4.3 Review gate fields

Use review fields when a human or designated reviewer must approve the work before the loop proceeds or concludes.

Minimum review gate fields:

- `required`: whether review is required.
- `reviewer`: who should review.
- `status`: current review state.
- `required_before`: the phase before which approval is needed.
- `evidence`: concise pointer to the approval, waiver, or requested changes.

A review gate should be required when:

- The contract lists a relevant `human_confirmations` item.
- The next step would exceed the current scope.
- The work has product, security, data, permission, deployment, or large-diff implications.
- The user explicitly asks for review before continuing.

## 5. Manual Repeat Loop Examples

These examples show how to repeat LoopPilot manually without adding a background runner.

### 5.1 Chat-only manual repeat loop

User:

```text
Use LoopPilot for this lint cleanup. Run at most 3 rounds. Gate is `npm run lint`. Do not save files except source edits.
```

Agent behavior:

1. Render decision JSON and the contract in chat.
2. Ask for confirmation if not already provided.
3. Run one round in the current session.
4. Run `npm run lint`.
5. If the gate fails and the stop conditions allow another round, summarize the failure and continue manually in the same chat.
6. Stop when the gate passes, the same failure appears twice, max rounds are reached, or a forbidden action is needed.
7. Report in chat only.

No `.looppilot/VISION.md`, `.looppilot/STATE.md`, or `.looppilot/RUN_LOG.md` is created because the user explicitly said not to save loop artifacts.

### 5.2 Manual repeat loop with persisted state

User:

```text
Create LoopPilot reusable artifacts for this docs cleanup so another session can resume. Then run one manual round only.
```

Agent behavior:

1. Render decision JSON and the contract in chat.
2. Create or update `.looppilot/VISION.md`, `.looppilot/STATE.md`, and `.looppilot/RUN_LOG.md` because persistence was explicitly requested.
3. Run exactly one manual round in the current session.
4. Run the verifier gate or mark why it was blocked.
5. Append one `RUN_LOG.md` entry.
6. Update `STATE.md` with the next manual step.
7. Stop and report in chat.

A later session can resume only after the user asks it to read the saved artifacts and continue. The files themselves do not trigger execution.

### 5.3 Manual repeat loop with review gate

User:

```text
Loop on the API docs until the markdown check passes, but require human review before any second round.
```

Contract implications:

- Verifier gate: markdown check command exits zero.
- Review gate: required before `next_round`.
- Stop condition: pause after round 1 if review is pending.

Manual flow:

1. Round 1 edits the docs.
2. The agent runs the markdown check.
3. If the check fails, the agent reports the failure and asks for human review before another round.
4. The user may approve another round, request changes, or stop.
5. No background process waits, polls, or resumes automatically.

## 6. Non-Implementation Requirements

This phase must not implement:

- A background runner.
- A daemon, scheduler, watcher, or queue worker.
- Automatic polling of gates or reviews.
- Autonomous resume from `.looppilot/STATE.md`.
- Provider adapters or an external execution engine.
- Any implicit file writes when the user has not requested persistence.

Future phases may add parsers or tooling around these artifacts, but any execution mechanism must be separately designed and reviewed. The v1 artifacts are reusable documentation and handoff files only.
