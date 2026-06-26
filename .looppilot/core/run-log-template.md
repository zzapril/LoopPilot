# LoopPilot Run Log Template

This is a manual artifact for append-only notes about human-supervised loop rounds. It is not a background runner state file, daemon checkpoint, scheduler input, or automatic execution record.

Write or save this file only when explicitly requested. LoopPilot must not create or update run-log files by default.

```markdown
# LoopPilot Run Log

schema_version: 1
artifact: RUN_LOG
created_at: <ISO-8601 timestamp>

## Entries

### <ISO-8601 timestamp> - Round <n> - <status>
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
