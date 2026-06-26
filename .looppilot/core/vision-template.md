# LoopPilot Vision Template

This is a manual artifact for durable project or loop intent. It is not a background runner state file, daemon checkpoint, scheduler input, or automatic execution record.

Write or save this file only when explicitly requested. LoopPilot must not create or update vision files by default.

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
