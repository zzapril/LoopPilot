#!/usr/bin/env node
import fs from "node:fs";

const file = ".looppilot/core/review-gate-template.md";
const errors = [];

if (!fs.existsSync(file)) {
  errors.push(`${file}: missing`);
} else {
  const text = fs.readFileSync(file, "utf8");
  const requiredSections = [
    "## Original goal",
    "## Contract gate",
    "## Commands run",
    "## Pass/fail evidence",
    "## Unresolved risks",
    "## Human review checklist",
  ];
  const requiredDisclaimers = [
    "manual artifact",
    "not an automatic approval gate",
    "deployment gate",
    "A human reviewer remains responsible",
    "do not treat this artifact as automatic approval",
  ];

  for (const section of requiredSections) {
    if (!text.includes(section)) errors.push(`${file}: missing required section ${section}`);
  }
  for (const disclaimer of requiredDisclaimers) {
    if (!text.includes(disclaimer)) errors.push(`${file}: missing safety disclaimer ${disclaimer}`);
  }
}

if (errors.length > 0) {
  console.error("LoopPilot review gate template validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot review gate template validation passed.");
