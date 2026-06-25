#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile, readJsonlFile, validateFixtureSet } from "./lib/decision-validator.mjs";
import { validateWrappers } from "./lib/wrapper-validator.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const coreFiles = [
  ".looppilot/core/qualification-rules.md",
  ".looppilot/core/decision-schema.json",
  ".looppilot/core/contract-template.md",
  ".looppilot/fixtures/decision-fixtures.jsonl",
];

const codexFiles = [".agents/skills/looppilot/SKILL.md"];
const claudeFiles = [
  ".claude/skills/looppilot/SKILL.md",
  ".claude/commands/should-loop.md",
];

function printHelp() {
  console.log(`LoopPilot

Usage:
  looppilot install [--target both|codex|claude] [--scope project] [--cwd <path>] [--force] [--dry-run]
  looppilot doctor [--target both|codex|claude] [--cwd <path>]

Notes:
  install copies the Agent Pack only. It does not run loops.
  doctor validates installed core files, fixtures, and wrappers.
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {
    command,
    target: "both",
    scope: "project",
    cwd: process.cwd(),
    force: false,
    dryRun: false,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--target") options.target = rest[++index];
    else if (arg === "--scope") options.scope = rest[++index];
    else if (arg === "--cwd") options.cwd = rest[++index];
    else if (arg === "--force") options.force = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function filesForTarget(target) {
  if (target === "both") return [...coreFiles, ...codexFiles, ...claudeFiles];
  if (target === "codex") return [...coreFiles, ...codexFiles];
  if (target === "claude") return [...coreFiles, ...claudeFiles];
  throw new Error(`Unsupported target: ${target}`);
}

function assertProjectScope(scope) {
  if (scope !== "project") {
    throw new Error("LoopPilot v0 only supports --scope project.");
  }
}

function sameFileContent(source, destination) {
  if (!fs.existsSync(destination)) return false;
  return fs.readFileSync(source, "utf8") === fs.readFileSync(destination, "utf8");
}

function copyPackFile(relativePath, targetRoot, options) {
  const source = path.join(packageRoot, relativePath);
  const destination = path.join(targetRoot, relativePath);

  if (!fs.existsSync(source)) {
    throw new Error(`Source pack file is missing: ${relativePath}`);
  }

  if (fs.existsSync(destination) && !sameFileContent(source, destination) && !options.force) {
    throw new Error(`${relativePath} already exists and differs. Re-run with --force to overwrite.`);
  }

  if (options.dryRun) {
    return fs.existsSync(destination) && sameFileContent(source, destination) ? "unchanged" : "would-write";
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination) && sameFileContent(source, destination)) return "unchanged";
  fs.copyFileSync(source, destination);
  return "written";
}

function install(options) {
  assertProjectScope(options.scope);
  const targetRoot = path.resolve(options.cwd);
  const files = filesForTarget(options.target);
  const results = { written: 0, unchanged: 0, wouldWrite: 0 };

  for (const file of files) {
    const status = copyPackFile(file, targetRoot, options);
    if (status === "written") results.written += 1;
    else if (status === "unchanged") results.unchanged += 1;
    else if (status === "would-write") results.wouldWrite += 1;
  }

  console.log("LoopPilot install completed.");
  console.log(`Target: ${options.target}`);
  console.log(`Scope: ${options.scope}`);
  console.log(`Project: ${targetRoot}`);
  if (options.dryRun) console.log(`Would write: ${results.wouldWrite}`);
  else console.log(`Written: ${results.written}`);
  console.log(`Unchanged: ${results.unchanged}`);
}

function checkFilesExist(root, files) {
  const missing = [];
  for (const file of files) {
    if (!fs.existsSync(path.join(root, file))) missing.push(file);
  }
  return missing;
}

function doctor(options) {
  const targetRoot = path.resolve(options.cwd);
  const files = filesForTarget(options.target);
  const errors = [];

  const missing = checkFilesExist(targetRoot, files);
  for (const file of missing) errors.push(`${file}: missing`);

  if (missing.length === 0) {
    try {
      readJsonFile(path.join(targetRoot, ".looppilot/core/decision-schema.json"));
      const fixtures = readJsonlFile(path.join(targetRoot, ".looppilot/fixtures/decision-fixtures.jsonl"));
      const fixtureResult = validateFixtureSet(fixtures);
      errors.push(...fixtureResult.errors);
    } catch (error) {
      errors.push(error.message);
    }

    const wrapperResult = validateWrappers(targetRoot);
    if (options.target === "both") errors.push(...wrapperResult.errors);
    if (options.target === "codex") {
      errors.push(...wrapperResult.errors.filter((error) => error.startsWith(".agents/")));
    }
    if (options.target === "claude") {
      errors.push(...wrapperResult.errors.filter((error) => error.startsWith(".claude/")));
    }
  }

  if (errors.length > 0) {
    console.error("LoopPilot doctor failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("LoopPilot doctor passed.");
  console.log(`Target: ${options.target}`);
  console.log(`Project: ${targetRoot}`);
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.command || options.help) {
    printHelp();
  } else if (options.command === "install") {
    install(options);
  } else if (options.command === "doctor") {
    doctor(options);
  } else {
    throw new Error(`Unknown command: ${options.command}`);
  }
} catch (error) {
  console.error(`LoopPilot error: ${error.message}`);
  process.exit(1);
}
