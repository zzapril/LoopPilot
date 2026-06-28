#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const cli = path.resolve("scripts/looppilot.mjs");
const errors = [];
const missingProjectDir = path.join("/private/tmp", `looppilot-missing-cli-${process.pid}`);

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

for (const args of [["--help"], ["-h"], ["help"], ["doctor", "--help"]]) {
  const result = run(args);
  const output = `${result.stderr}${result.stdout}`;
  if (result.status !== 0) errors.push(`${args.join(" ")}: expected help to succeed`);
  if (!output.includes("Usage:")) errors.push(`${args.join(" ")}: expected help output, got ${JSON.stringify(output.trim())}`);
}

const defaultHelp = run(["--help"]);
if (!defaultHelp.stdout.includes("looppilot install")) errors.push("--help: missing install quickstart");
if (!defaultHelp.stdout.includes("Claude Code: /should-loop <task-or-issue-url>")) errors.push("--help: missing Claude Code primary usage");
if (!defaultHelp.stdout.includes("Codex:      Use LoopPilot on <task-or-issue-url>")) errors.push("--help: missing Codex primary usage");
if (!defaultHelp.stdout.includes("looppilot help advanced")) errors.push("--help: missing advanced help pointer");
for (const advancedOnly of ["looppilot issue-intake --url", "looppilot save-contract", "looppilot export --target"]) {
  if (defaultHelp.stdout.includes(advancedOnly)) errors.push(`--help: exposed advanced command ${advancedOnly}`);
}

const advancedHelp = run(["help", "advanced"]);
if (advancedHelp.status !== 0) errors.push("help advanced: expected help to succeed");
for (const expected of ["Advanced / Debug", "looppilot issue-intake --url", "looppilot scan", "looppilot export --target", "looppilot save-contract"]) {
  if (!advancedHelp.stdout.includes(expected)) errors.push(`help advanced: missing ${expected}`);
}

for (const [args, expected] of [
  [["doctor", "--cwd"], "Missing value for --cwd."],
  [["install", "--target", "--dry-run"], "Missing value for --target."],
  [["export", "--target"], "Missing value for --target."],
  [["issue-intake", "--url"], "Missing value for --url."],
  [["issue-intake", "--number"], "Missing value for --number."],
  [["save-report", "--from"], "Missing value for --from."],
  [["doctor", "--unknown"], "Unknown argument: --unknown"],
  [["install", "--json", "--dry-run"], "install does not support --json."],
  [["issue-intake", "--target", "codex", "--url", "https://github.com/acme/widgets/issues/1"], "issue-intake does not support --target."],
  [["issue-intake", "--dry-run", "--url", "https://github.com/acme/widgets/issues/1"], "issue-intake --dry-run requires --output."],
  [["issue-intake", "--force", "--url", "https://github.com/acme/widgets/issues/1"], "issue-intake --force requires --output."],
  [["issue-intake"], "issue-intake requires --url or --repo/--number."],
  [["issue-intake", "--url", "https://github.com/acme/widgets/pull/1"], "issue-intake accepts GitHub issues, not pull requests."],
  [["save-vision", "--target", "claude", "--from", "README.md", "--dry-run"], "save-vision does not support --target."],
  [["scan", "--target", "both"], "scan does not support --target."],
  [["doctor", "--output", "doctor.json"], "doctor --output requires --json."],
  [["doctor", "--force"], "doctor --force requires --output."],
  [["doctor", "--dry-run"], "doctor --dry-run requires --output."],
  [["install", "--cwd", missingProjectDir, "--dry-run"], "Project directory does not exist"],
  [["doctor", "--cwd", missingProjectDir], "Project directory does not exist"],
  [["export", "--target", "codex", "--cwd", missingProjectDir, "--dry-run"], "Project directory does not exist"],
  [["save-report", "--cwd", missingProjectDir, "--from", "source.md", "--dry-run"], "Project directory does not exist"],
  [["scan", "--cwd", missingProjectDir], "Project directory does not exist"],
  [["host-capabilities", "--cwd", missingProjectDir], "Project directory does not exist"],
  [["claude-project-summary", "--cwd", missingProjectDir], "Project directory does not exist"],
]) {
  const result = run(args);
  const output = `${result.stderr}${result.stdout}`;
  if (result.status === 0) errors.push(`${args.join(" ")}: expected failure`);
  if (!output.includes(expected)) errors.push(`${args.join(" ")}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(output.trim())}`);
  if (output.includes("paths[0]") || output.includes("Received undefined")) {
    errors.push(`${args.join(" ")}: leaked low-level Node.js argument error`);
  }
}

if (fs.existsSync(missingProjectDir)) {
  errors.push("missing --cwd validation created the missing project directory");
}

if (errors.length > 0) {
  console.error("LoopPilot CLI argument validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot CLI argument validation passed.");
