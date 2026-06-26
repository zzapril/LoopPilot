#!/usr/bin/env node
import fs from "node:fs";

const files = [
  ".looppilot/core/export-template-codex.md",
  ".looppilot/core/export-template-claude.md",
  ".looppilot/core/export-template-github-issue.md",
];
const required = [
  "handoff",
  "not controlled execution",
  ".looppilot/core/qualification-rules.md",
  ".looppilot/core/decision-schema.json",
  ".looppilot/core/contract-template.md",
  "schema-valid JSON first",
];
const forbiddenDefaults = ["automatically commit", "automatically push", "automatically deploy"];

const errors = [];
for (const file of files) {
  if (!fs.existsSync(file)) {
    errors.push(`${file}: missing`);
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  for (const phrase of required) {
    if (!text.includes(phrase)) errors.push(`${file}: missing required phrase ${phrase}`);
  }
  for (const phrase of forbiddenDefaults) {
    if (text.toLowerCase().includes(phrase)) errors.push(`${file}: contains unsafe default phrase ${phrase}`);
  }
}

if (!fs.existsSync(".looppilot/core/report-template.md")) errors.push(".looppilot/core/report-template.md: missing");
else {
  const report = fs.readFileSync(".looppilot/core/report-template.md", "utf8");
  for (const phrase of ["What changed", "Commands run", "Gate result", "Risks or blockers", "Next steps", "Do not write `.looppilot/latest-report.md` by default"]) {
    if (!report.includes(phrase)) errors.push(`.looppilot/core/report-template.md: missing ${phrase}`);
  }
}

for (const generated of [".looppilot/exports/RUN_IN_CODEX.md", ".looppilot/exports/RUN_IN_CLAUDE.md", ".looppilot/exports/github-issue.md"]) {
  if (fs.existsSync(generated)) errors.push(`${generated}: generated export should not exist by default`);
}

if (errors.length > 0) {
  console.error("LoopPilot export validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot export validation passed.");
console.log(`Templates: ${files.length}`);
