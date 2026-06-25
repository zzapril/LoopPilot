#!/usr/bin/env node
import fs from "node:fs";

const requiredCoreRefs = [
  ".looppilot/core/qualification-rules.md",
  ".looppilot/core/decision-schema.json",
  ".looppilot/core/contract-template.md",
];

const wrappers = [
  {
    path: ".agents/skills/looppilot/SKILL.md",
    host: "\"host\": \"codex\"",
  },
  {
    path: ".claude/skills/looppilot/SKILL.md",
    host: "\"host\": \"claude_code\"",
  },
];

const errors = [];

function assertFile(path) {
  if (!fs.existsSync(path)) {
    errors.push(`${path}: missing`);
    return "";
  }
  return fs.readFileSync(path, "utf8");
}

for (const wrapper of wrappers) {
  const text = assertFile(wrapper.path);
  if (!text) continue;

  for (const ref of requiredCoreRefs) {
    if (!text.includes(ref)) {
      errors.push(`${wrapper.path}: missing shared core reference ${ref}`);
    }
  }

  if (!text.includes(wrapper.host)) {
    errors.push(`${wrapper.path}: missing host profile ${wrapper.host}`);
  }

  if (!text.includes("Do not duplicate") || !text.includes("shared core")) {
    errors.push(`${wrapper.path}: must state that shared core is the source of truth`);
  }

  if (!text.includes("JSON decision") || !text.includes("decision-schema.json")) {
    errors.push(`${wrapper.path}: must require schema-valid JSON first`);
  }
}

const commandText = assertFile(".claude/commands/should-loop.md");
if (commandText) {
  if (!commandText.includes(".claude/skills/looppilot/SKILL.md")) {
    errors.push(".claude/commands/should-loop.md: must reference the Claude skill");
  }
  if (!commandText.includes("must not duplicate")) {
    errors.push(".claude/commands/should-loop.md: must forbid duplicated rules");
  }
}

if (errors.length > 0) {
  console.error("LoopPilot wrapper validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot wrapper validation passed.");
console.log(`Wrappers: ${wrappers.length}`);
console.log("Claude command alias: present");
