# LoopPilot State Template

This is a manual artifact for the current human-supervised loop checkpoint. It is not a background runner state file, daemon checkpoint, scheduler input, or automatic execution record.

Write or save this file only when explicitly requested. LoopPilot must not create or update state files by default.

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
