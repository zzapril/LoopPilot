import fs from "node:fs";
import path from "node:path";

const requiredCoreRefs = [
  ".looppilot/core/qualification-rules.md",
  ".looppilot/core/decision-schema.json",
  ".looppilot/core/contract-template.md",
];

const wrapperSpecs = [
  {
    path: ".agents/skills/looppilot/SKILL.md",
    host: "\"host\": \"codex\"",
  },
  {
    path: ".claude/skills/looppilot/SKILL.md",
    host: "\"host\": \"claude_code\"",
  },
];

function readIfExists(root, relativePath, errors) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${relativePath}: missing`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

export function validateWrappers(root = process.cwd()) {
  const errors = [];

  for (const wrapper of wrapperSpecs) {
    const text = readIfExists(root, wrapper.path, errors);
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

  const commandText = readIfExists(root, ".claude/commands/should-loop.md", errors);
  if (commandText) {
    if (!commandText.includes(".claude/skills/looppilot/SKILL.md")) {
      errors.push(".claude/commands/should-loop.md: must reference the Claude skill");
    }
    if (!commandText.includes("must not duplicate")) {
      errors.push(".claude/commands/should-loop.md: must forbid duplicated rules");
    }
  }

  return {
    errors,
    wrappers: wrapperSpecs.length,
    hasClaudeCommandAlias: fs.existsSync(path.join(root, ".claude/commands/should-loop.md")),
  };
}
