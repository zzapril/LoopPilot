#!/usr/bin/env node
import fs from "node:fs";

const templateChecks = {
  ".looppilot/core/vision-template.md": [
    "manual artifact",
    "not a background runner state file",
    "only when explicitly requested",
    "must not create or update",
    "schema_version: 1",
    "artifact: VISION",
    "created_at: <ISO-8601 timestamp>",
    "updated_at: <ISO-8601 timestamp>",
    "## Purpose",
    "## Non-Goals",
    "## Success Criteria",
    "## Durable Scope",
    "## Constraints",
    "## Review Expectations",
  ],
  ".looppilot/core/state-template.md": [
    "manual artifact",
    "not a background runner state file",
    "only when explicitly requested",
    "must not create or update",
    "schema_version: 1",
    "artifact: STATE",
    "status: <not_started|in_progress|blocked|gate_passed|stopped>",
    "## Current Goal",
    "## Active Contract Snapshot",
    "## Scope",
    "## Allowed Actions",
    "## Forbidden Actions",
    "## Stop Conditions",
    "## Verifier Gate",
    "## Review Gate",
    "## Next Manual Step",
    "## Open Questions",
  ],
  ".looppilot/core/run-log-template.md": [
    "manual artifact",
    "not a background runner state file",
    "only when explicitly requested",
    "must not create or update",
    "schema_version: 1",
    "artifact: RUN_LOG",
    "created_at: <ISO-8601 timestamp>",
    "## Entries",
    "contract_source:",
    "actions_taken:",
    "files_changed:",
    "verifier_gate:",
    "review_gate:",
    "stop_reason:",
    "next_step:",
  ],
};

const errors = [];

for (const [template, requiredPhrases] of Object.entries(templateChecks)) {
  if (!fs.existsSync(template)) {
    errors.push(`${template}: missing`);
    continue;
  }

  const content = fs.readFileSync(template, "utf8");
  const lowercaseContent = content.toLowerCase();
  for (const phrase of requiredPhrases) {
    const haystack = phrase === phrase.toLowerCase() ? lowercaseContent : content;
    if (!haystack.includes(phrase)) errors.push(`${template}: missing required phrase "${phrase}"`);
  }
}

if (errors.length > 0) {
  console.error("LoopPilot manual template validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot manual template validation passed.");
