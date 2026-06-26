#!/usr/bin/env node
import fs from "node:fs";

const templates = [
  ".looppilot/core/vision-template.md",
  ".looppilot/core/state-template.md",
  ".looppilot/core/run-log-template.md",
];

const requiredPhrases = [
  "manual artifact",
  "not a background runner state file",
  "only when explicitly requested",
  "must not create or update",
];

const errors = [];

for (const template of templates) {
  if (!fs.existsSync(template)) {
    errors.push(`${template}: missing`);
    continue;
  }

  const content = fs.readFileSync(template, "utf8").toLowerCase();
  for (const phrase of requiredPhrases) {
    if (!content.includes(phrase)) errors.push(`${template}: missing required phrase "${phrase}"`);
  }
}

if (errors.length > 0) {
  console.error("LoopPilot manual template validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot manual template validation passed.");
