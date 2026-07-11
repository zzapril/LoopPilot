import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runIssueIntake } from "../../.looppilot/scripts/issue-intake.mjs";
import { readJsonFile, readJsonlFile, validateFixtureSet } from "./decision-validator.mjs";
import { validateDecisionAgainstSchema, validateDecisionSchemaDefinition } from "./schema-validator.mjs";
import { validateWrappers } from "./wrapper-validator.mjs";
import { validateWrapperParity } from "./wrapper-parity.mjs";
import {
  assertSafeOutputDestination,
  assertSafeProjectPath,
  copyFileAtomically,
  isInsideProject,
  isSensitivePath,
  writeTextAtomically,
} from "../../.looppilot/scripts/file-safety.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const coreFiles = [
  ".looppilot/core/qualification-rules.md",
  ".looppilot/core/decision-schema.json",
  ".looppilot/core/contract-template.md",
  ".looppilot/core/export-template-codex.md",
  ".looppilot/core/export-template-claude.md",
  ".looppilot/core/export-template-github-issue.md",
  ".looppilot/core/report-template.md",
  ".looppilot/core/vision-template.md",
  ".looppilot/core/state-template.md",
  ".looppilot/core/run-log-template.md",
  ".looppilot/core/review-gate-template.md",
  ".looppilot/fixtures/decision-fixtures.jsonl",
  ".looppilot/scripts/scan-summary.mjs",
  ".looppilot/scripts/claude-project-summary.mjs",
  ".looppilot/scripts/host-capability-summary.mjs",
  ".looppilot/scripts/file-safety.mjs",
  ".looppilot/scripts/issue-intake.mjs",
];

const codexFiles = [".agents/skills/looppilot/SKILL.md"];
const claudeFiles = [
  ".claude/skills/looppilot/SKILL.md",
  ".claude/commands/should-loop.md",
];

const wrapperFilesByTarget = {
  both: [...codexFiles, ...claudeFiles],
  codex: codexFiles,
  claude: claudeFiles,
};

function printHelp() {
  console.log(`LoopPilot

Install once, then ask your current agent whether a task should loop.

Usage:
  looppilot install
  looppilot doctor [--json]

Agent usage:
  Claude Code: /should-loop <task-or-issue-url>
  Codex:      Use LoopPilot on <task-or-issue-url>

Notes:
  install copies the Codex and Claude Code Agent Pack into this project.
  doctor verifies the installed files and safety fixtures.
  LoopPilot does not run background loops, commit, push, deploy, publish, or mutate dependencies. Locked dependency setup requires explicit confirmation and is limited to pnpm install --frozen-lockfile, npm ci, or bun install --frozen-lockfile.
  Advanced/debug commands are available with: looppilot help advanced
`);
}

function printAdvancedHelp() {
  console.log(`LoopPilot Advanced / Debug

Usage:
  looppilot install [--target both|codex|claude] [--scope project] [--cwd <path>] [--force] [--dry-run]
  looppilot doctor [--target both|codex|claude] [--cwd <path>] [--json] [--output <path>] [--force] [--dry-run]
  looppilot export --target codex|claude|github-issue [--cwd <path>] [--output <path>] [--force] [--dry-run]
  looppilot issue-intake --url <github-issue-url> [--cwd <path>] [--json] [--output <path>] [--force] [--dry-run]
  looppilot issue-intake --repo owner/name --number <issue-number> [--cwd <path>] [--json] [--output <path>] [--force] [--dry-run]
  looppilot save-contract --from <path> [--cwd <path>] [--output <path>] [--force] [--dry-run]
  looppilot save-report --from <path> [--cwd <path>] [--output <path>] [--force] [--dry-run]
  looppilot save-vision --from <path> [--cwd <path>] [--output <path>] [--force] [--dry-run]
  looppilot save-state --from <path> [--cwd <path>] [--output <path>] [--force] [--dry-run]
  looppilot save-run-log --from <path> [--cwd <path>] [--output <path>] [--force] [--dry-run]
  looppilot save-review-gate --from <path> [--cwd <path>] [--output <path>] [--force] [--dry-run]
  looppilot scan [--cwd <path>]
  looppilot host-capabilities [--cwd <path>]
  looppilot claude-project-summary [--cwd <path>]

Notes:
  install copies the Agent Pack only. It does not run loops.
  doctor checks installed Agent Pack files, fixtures, and wrappers.
  export writes handoff files only when explicitly requested. It does not execute loops.
  issue-intake is a read-only helper for agent-native GitHub issue URL handoff.
  save-* commands write manual artifacts only when explicitly requested.
  scan prints a read-only repository evidence summary.
  host-capabilities prints optional read-only host capability evidence.
  claude-project-summary prints optional read-only Claude project metadata only.
  unsupported command options fail instead of being ignored.
`);
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {
    command,
    seenOptions: [],
    target: "both",
    scope: "project",
    cwd: process.cwd(),
    force: false,
    dryRun: false,
    output: null,
    from: null,
    repo: null,
    number: null,
    url: null,
    json: false,
    advancedHelp: false,
  };

  if (command === "help" && rest.length === 1 && rest[0] === "advanced") {
    options.command = null;
    options.help = true;
    options.advancedHelp = true;
    return options;
  }

  if (command === "--help" || command === "-h" || command === "help") {
    options.command = null;
    options.help = true;
  }

  function readOptionValue(name, index) {
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}.`);
    }
    return value;
  }

  function recordOption(name) {
    if (options.seenOptions.includes(name)) {
      throw new Error(`Duplicate option: ${name}.`);
    }
    options.seenOptions.push(name);
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--target") {
      recordOption(arg);
      options.target = readOptionValue(arg, index++);
    } else if (arg === "--scope") {
      recordOption(arg);
      options.scope = readOptionValue(arg, index++);
    } else if (arg === "--cwd") {
      recordOption(arg);
      options.cwd = readOptionValue(arg, index++);
    } else if (arg === "--output") {
      recordOption(arg);
      options.output = readOptionValue(arg, index++);
    } else if (arg === "--from") {
      recordOption(arg);
      options.from = readOptionValue(arg, index++);
    } else if (arg === "--repo") {
      recordOption(arg);
      options.repo = readOptionValue(arg, index++);
    } else if (arg === "--number") {
      recordOption(arg);
      options.number = readOptionValue(arg, index++);
    } else if (arg === "--url") {
      recordOption(arg);
      options.url = readOptionValue(arg, index++);
    } else if (arg === "--json") {
      recordOption(arg);
      options.json = true;
    } else if (arg === "--force") {
      recordOption(arg);
      options.force = true;
    } else if (arg === "--dry-run") {
      recordOption(arg);
      options.dryRun = true;
    } else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  validateCommandOptions(options);
  return options;
}

function validateCommandOptions(options) {
  if (!options.command || options.help) return;

  const saveCommands = new Set([
    "save-contract",
    "save-report",
    "save-vision",
    "save-state",
    "save-run-log",
    "save-review-gate",
  ]);
  const saveOptions = new Set(["--from", "--cwd", "--output", "--force", "--dry-run"]);
  const allowedOptionsByCommand = new Map([
    ["install", new Set(["--target", "--scope", "--cwd", "--force", "--dry-run"])],
    ["doctor", new Set(["--target", "--cwd", "--json", "--output", "--force", "--dry-run"])],
    ["export", new Set(["--target", "--cwd", "--output", "--force", "--dry-run"])],
    ["issue-intake", new Set(["--url", "--repo", "--number", "--cwd", "--json", "--output", "--force", "--dry-run"])],
    ["scan", new Set(["--cwd"])],
    ["host-capabilities", new Set(["--cwd"])],
    ["claude-project-summary", new Set(["--cwd"])],
  ]);

  const allowedOptions = saveCommands.has(options.command)
    ? saveOptions
    : allowedOptionsByCommand.get(options.command);
  if (!allowedOptions) return;

  for (const option of options.seenOptions) {
    if (!allowedOptions.has(option)) {
      throw new Error(`${options.command} does not support ${option}.`);
    }
  }

  if (options.command === "doctor") {
    if (options.output && !options.json) {
      throw new Error("doctor --output requires --json.");
    }
    if (options.force && !options.output) {
      throw new Error("doctor --force requires --output.");
    }
    if (options.dryRun && !options.output) {
      throw new Error("doctor --dry-run requires --output.");
    }
  }

  if (options.command === "issue-intake") {
    if (options.force && !options.output) {
      throw new Error("issue-intake --force requires --output.");
    }
    if (options.dryRun && !options.output) {
      throw new Error("issue-intake --dry-run requires --output.");
    }
  }
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

function assertDirectoryExists(directory, label) {
  let stat;
  try {
    stat = fs.statSync(directory);
  } catch {
    throw new Error(`${label} directory does not exist: ${directory}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`${label} path is not a directory: ${directory}`);
  }
}

function sameFileContent(source, destination) {
  if (!fs.existsSync(destination)) return false;
  return fs.readFileSync(source, "utf8") === fs.readFileSync(destination, "utf8");
}

function inspectPackFile(relativePath, targetRoot, options) {
  const source = path.join(packageRoot, relativePath);
  const destination = path.join(targetRoot, relativePath);

  if (!fs.existsSync(source)) {
    throw new Error(`Source pack file is missing: ${relativePath}`);
  }

  assertSafeProjectPath(targetRoot, destination, relativePath, "install");

  const destinationExists = fs.existsSync(destination);
  if (destinationExists && !fs.lstatSync(destination).isFile()) {
    throw new Error(`${relativePath} exists but is not a file.`);
  }
  const unchanged = destinationExists && sameFileContent(source, destination);
  if (destinationExists && !unchanged && !options.force) {
    throw new Error(`${relativePath} already exists and differs. Re-run with --force to overwrite.`);
  }

  return {
    relativePath,
    source,
    destination,
    destinationExists,
    status: unchanged ? "unchanged" : options.dryRun ? "would-write" : "written",
  };
}

function ensureInstallParentDirectories(destination, targetRoot, createdDirectories) {
  const missing = [];
  let current = path.dirname(destination);
  while (current !== targetRoot && !fs.existsSync(current)) {
    missing.push(current);
    const parent = path.dirname(current);
    if (parent === current || !isInsideProject(targetRoot, parent)) {
      throw new Error(`Cannot create install directory outside project root: ${current}`);
    }
    current = parent;
  }
  for (const directory of missing.reverse()) {
    fs.mkdirSync(directory);
    createdDirectories.push(directory);
  }
}

function applyInstallPlan(entries, targetRoot) {
  const rollbackRoot = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-install-rollback-"));
  const applied = [];
  const createdDirectories = [];
  try {
    for (const entry of entries) {
      if (entry.status === "unchanged") continue;
      ensureInstallParentDirectories(entry.destination, targetRoot, createdDirectories);
      let backup = null;
      if (entry.destinationExists) {
        backup = path.join(rollbackRoot, entry.relativePath);
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        fs.copyFileSync(entry.destination, backup);
      }
      applied.push({ ...entry, backup });
      copyFileAtomically(entry.source, entry.destination);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of [...applied].reverse()) {
      try {
        if (entry.backup) copyFileAtomically(entry.backup, entry.destination);
        else fs.rmSync(entry.destination, { force: true });
      } catch (rollbackError) {
        rollbackErrors.push(`${entry.relativePath}: ${rollbackError.message}`);
      }
    }
    for (const directory of [...createdDirectories].reverse()) {
      try {
        fs.rmdirSync(directory);
      } catch (rollbackError) {
        if (rollbackError.code !== "ENOENT" && rollbackError.code !== "ENOTEMPTY") {
          rollbackErrors.push(`${path.relative(targetRoot, directory)}: ${rollbackError.message}`);
        }
      }
    }
    const suffix = rollbackErrors.length > 0 ? ` Rollback failures: ${rollbackErrors.join("; ")}` : "";
    const detail = error.message.endsWith(".") ? error.message : `${error.message}.`;
    throw new Error(`Install failed and was rolled back: ${detail}${suffix}`);
  } finally {
    fs.rmSync(rollbackRoot, { recursive: true, force: true });
  }
}

export function install(options) {
  assertProjectScope(options.scope);
  const targetRoot = path.resolve(options.cwd);
  assertDirectoryExists(targetRoot, "Project");
  const files = filesForTarget(options.target);
  const entries = files.map((file) => inspectPackFile(file, targetRoot, options));
  const results = { written: 0, unchanged: 0, wouldWrite: 0 };
  for (const entry of entries) {
    if (entry.status === "written") results.written += 1;
    else if (entry.status === "unchanged") results.unchanged += 1;
    else if (entry.status === "would-write") results.wouldWrite += 1;
  }
  if (!options.dryRun) applyInstallPlan(entries, targetRoot);

  console.log("LoopPilot install completed.");
  console.log(`Target: ${options.target}`);
  console.log(`Scope: ${options.scope}`);
  console.log(`Project: ${targetRoot}`);
  if (options.dryRun) console.log(`Would write: ${results.wouldWrite}`);
  else console.log(`Written: ${results.written}`);
  console.log(`Unchanged: ${results.unchanged}`);
  console.log("Next:");
  console.log("  Claude Code: /should-loop <task-or-issue-url>");
  console.log("  Codex: Use LoopPilot on <task-or-issue-url>");
  console.log("  Verify: looppilot doctor");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function safeSha256File(filePath) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) return null;
  return sha256File(filePath);
}

function getShortCommit(root) {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });

  if (result.status !== 0) return null;
  const commit = result.stdout.trim();
  return commit || null;
}

function buildDoctorMetadata(targetRoot, target, files, missing, fixtureSummary, durationMs) {
  const packageInfo = readJsonFile(path.join(packageRoot, "package.json"));
  const schema = readJsonFile(path.join(packageRoot, ".looppilot/core/decision-schema.json"));
  const missingSet = new Set(missing);

  return {
    commit: getShortCommit(targetRoot),
    package: {
      name: packageInfo.name,
      version: packageInfo.version,
    },
    schema: {
      id: schema.$id,
    },
    target,
    project: targetRoot,
    timestamp: new Date().toISOString(),
    fixture: {
      total: fixtureSummary.total,
      counts: fixtureSummary.counts,
    },
    wrapper_files: wrapperFilesByTarget[target],
    core_files: coreFiles,
    duration_ms: Math.round(durationMs),
    installedFileCount: files.length - missing.length,
    missingFileCount: missing.length,
    files: files
      .filter((file) => !missingSet.has(file))
      .map((file) => ({
        path: file,
        sha256: safeSha256File(path.join(targetRoot, file)),
      })),
  };
}

function checkFilesExist(root, files) {
  const missing = [];
  for (const file of files) {
    if (!fs.existsSync(path.join(root, file))) missing.push(file);
  }
  return missing;
}

function checkPackFileIntegrity(root, files) {
  const errors = [];
  for (const file of files) {
    const source = path.join(packageRoot, file);
    const destination = path.join(root, file);
    if (!fs.existsSync(destination)) continue;
    const stat = fs.lstatSync(destination);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      errors.push(`${file}: must be a regular file; remove the unsafe path, then run looppilot install --force`);
      continue;
    }
    if (!sameFileContent(source, destination)) {
      errors.push(`${file}: differs from package source; run looppilot install --force to refresh the Agent Pack`);
    }
  }
  return errors;
}

function wrapperErrorsForTarget(errors, target) {
  if (target === "both") return errors;
  const wrapperPrefix = target === "codex" ? ".agents/" : ".claude/";
  return errors.filter((error) => error.startsWith(wrapperPrefix) || error.startsWith(".looppilot/core/"));
}

function exportTemplateForTarget(target) {
  if (target === "codex") return [".looppilot/core/export-template-codex.md", ".looppilot/exports/RUN_IN_CODEX.md"];
  if (target === "claude") return [".looppilot/core/export-template-claude.md", ".looppilot/exports/RUN_IN_CLAUDE.md"];
  if (target === "github-issue") return [".looppilot/core/export-template-github-issue.md", ".looppilot/exports/github-issue.md"];
  throw new Error(`Unsupported export target: ${target}`);
}

export function exportHandoff(options) {
  if (!["codex", "claude", "github-issue"].includes(options.target)) {
    throw new Error("Export requires --target codex, claude, or github-issue.");
  }
  const targetRoot = path.resolve(options.cwd);
  assertDirectoryExists(targetRoot, "Project");
  const [templatePath, defaultOutputPath] = exportTemplateForTarget(options.target);
  const source = path.join(targetRoot, templatePath);
  if (!fs.existsSync(source)) throw new Error(`Export template is missing: ${templatePath}`);
  assertSafeProjectPath(targetRoot, source, templatePath, "export");
  if (!fs.lstatSync(source).isFile()) throw new Error(`Export template is not a regular file: ${templatePath}`);

  const outputPath = path.resolve(targetRoot, options.output ?? defaultOutputPath);
  assertSafeOutputDestination(targetRoot, outputPath, "export");
  if (fs.existsSync(outputPath) && !options.force) {
    throw new Error(`${path.relative(targetRoot, outputPath)} already exists. Re-run with --force to overwrite.`);
  }

  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    copyFileAtomically(source, outputPath);
  }

  console.log("LoopPilot export completed.");
  console.log(`Target: ${options.target}`);
  console.log(`Output: ${path.relative(targetRoot, outputPath)}`);
  if (options.dryRun) console.log("Dry run: no file written.");
}

export function saveExplicitFile(options, kind) {
  const targetRoot = path.resolve(options.cwd);
  assertDirectoryExists(targetRoot, "Project");
  if (!options.from) throw new Error(`${kind} requires --from <path>.`);
  const source = path.resolve(targetRoot, options.from);
  if (!fs.existsSync(source)) throw new Error(`Source file is missing: ${path.relative(targetRoot, source)}`);
  const sourceRelative = path.relative(targetRoot, source);
  if (isInsideProject(targetRoot, source)) {
    assertSafeProjectPath(targetRoot, source, sourceRelative || ".", `save-${kind} source`);
  }
  if (isSensitivePath(source)) {
    throw new Error(`save-${kind} refuses to read a sensitive source path: ${source}`);
  }
  const sourceStat = fs.lstatSync(source);
  if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
    throw new Error(`Source must be a regular file, not a symbolic link or directory: ${path.relative(targetRoot, source)}`);
  }

  const defaultOutputs = {
    contract: ".looppilot/latest-contract.md",
    report: ".looppilot/latest-report.md",
    vision: ".looppilot/VISION.md",
    state: ".looppilot/STATE.md",
    "run-log": ".looppilot/RUN_LOG.md",
    "review-gate": ".looppilot/latest-review-gate.md",
  };
  const defaultOutput = defaultOutputs[kind];
  if (!defaultOutput) throw new Error(`Unsupported save kind: ${kind}`);
  const outputPath = path.resolve(targetRoot, options.output ?? defaultOutput);
  assertSafeOutputDestination(targetRoot, outputPath, `save-${kind}`);
  if (fs.existsSync(outputPath) && !options.force) {
    throw new Error(`${path.relative(targetRoot, outputPath)} already exists. Re-run with --force to overwrite.`);
  }

  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    copyFileAtomically(source, outputPath);
  }

  console.log(`LoopPilot save-${kind} completed.`);
  console.log(`Source: ${path.relative(targetRoot, source)}`);
  console.log(`Output: ${path.relative(targetRoot, outputPath)}`);
  if (options.dryRun) console.log("Dry run: no file written.");
}

export function doctor(options) {
  const startedAt = process.hrtime.bigint();
  const targetRoot = path.resolve(options.cwd);
  assertDirectoryExists(targetRoot, "Project");
  const reportOutputPath = options.output ? path.resolve(targetRoot, options.output) : null;
  if (reportOutputPath) {
    assertSafeOutputDestination(targetRoot, reportOutputPath, "doctor");
    if (fs.existsSync(reportOutputPath) && !options.force) {
      throw new Error(`${path.relative(targetRoot, reportOutputPath)} already exists. Re-run with --force to overwrite.`);
    }
  }
  const files = filesForTarget(options.target);
  const errors = [];
  const checks = [];
  let fixtureSummary = { total: 0, counts: { NO_GO: 0, PLAN_ONLY: 0, RUN_WITH_CONTRACT: 0 } };

  function recordCheck(name, checkErrors) {
    checks.push({ name, passed: checkErrors.length === 0, errors: checkErrors });
    errors.push(...checkErrors);
  }

  const missing = checkFilesExist(targetRoot, files);
  recordCheck("pack files", missing.map((file) => `${file}: missing`));
  const integrityErrors = checkPackFileIntegrity(targetRoot, files);
  recordCheck("pack integrity", integrityErrors);

  if (missing.length === 0 && integrityErrors.length === 0) {
    try {
      const schema = readJsonFile(path.join(targetRoot, ".looppilot/core/decision-schema.json"));
      const fixtures = readJsonlFile(path.join(targetRoot, ".looppilot/fixtures/decision-fixtures.jsonl"));
      const fixtureResult = validateFixtureSet(fixtures);
      fixtureSummary = { total: fixtureResult.total, counts: fixtureResult.counts };
      recordCheck("fixtures", fixtureResult.errors);
      recordCheck("schema definition", validateDecisionSchemaDefinition(schema));
      const schemaDecisionErrors = [];
      fixtures.forEach((fixture, index) => {
        schemaDecisionErrors.push(...validateDecisionAgainstSchema(fixture.expected_decision, schema, `fixtures[${index}].expected_decision`));
      });
      recordCheck("fixture decision schema", schemaDecisionErrors);
    } catch (error) {
      recordCheck("fixtures/schema read", [error.message]);
    }

    const wrapperResult = validateWrappers(targetRoot);
    const parityResult = validateWrapperParity(targetRoot);
    if (options.target === "both") {
      recordCheck("wrappers", wrapperResult.errors);
      recordCheck("wrapper parity", parityResult.errors);
    }
    if (options.target === "codex") {
      recordCheck("codex wrapper", wrapperErrorsForTarget(wrapperResult.errors, "codex"));
    }
    if (options.target === "claude") {
      recordCheck("claude wrapper", wrapperErrorsForTarget(wrapperResult.errors, "claude"));
    }
  }

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  const report = {
    ok: errors.length === 0,
    target: options.target,
    project: targetRoot,
    metadata: buildDoctorMetadata(targetRoot, options.target, files, missing, fixtureSummary, durationMs),
    checks,
  };

  if (options.json) {
    const output = JSON.stringify(report, null, 2);
    if (reportOutputPath) {
      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(reportOutputPath), { recursive: true });
        writeTextAtomically(reportOutputPath, `${output}\n`);
      }
      console.log(`LoopPilot doctor JSON report ${options.dryRun ? "would be written" : "written"}.`);
      console.log(`Output: ${path.relative(targetRoot, reportOutputPath)}`);
    } else if (errors.length > 0) console.error(output);
    else console.log(output);
  } else if (errors.length > 0) {
    console.error("LoopPilot doctor failed:");
    for (const error of errors) console.error(`- ${error}`);
  } else {
    console.log("LoopPilot doctor passed.");
    console.log(`Target: ${options.target}`);
    console.log(`Project: ${targetRoot}`);
    console.log(`Package: ${report.metadata.package.name}@${report.metadata.package.version}`);
    console.log(`Schema: ${report.metadata.schema.id}`);
    console.log(`Installed files: ${report.metadata.installedFileCount}`);
    console.log(`Missing files: ${report.metadata.missingFileCount}`);
    for (const check of checks) {
      console.log(`- ${check.passed ? "PASS" : "FAIL"}: ${check.name}`);
    }
  }

  return report;
}

export async function runCli(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (!options.command || options.help) {
      if (options.advancedHelp) printAdvancedHelp();
      else printHelp();
      return 0;
    }
    if (options.command === "install") install(options);
    else if (options.command === "doctor") return doctor(options).ok ? 0 : 1;
    else if (options.command === "export") exportHandoff(options);
    else if (options.command === "issue-intake") await runIssueIntake(options);
    else if (options.command === "save-contract") saveExplicitFile(options, "contract");
    else if (options.command === "save-report") saveExplicitFile(options, "report");
    else if (options.command === "save-vision") saveExplicitFile(options, "vision");
    else if (options.command === "save-state") saveExplicitFile(options, "state");
    else if (options.command === "save-run-log") saveExplicitFile(options, "run-log");
    else if (options.command === "save-review-gate") saveExplicitFile(options, "review-gate");
    else if (["scan", "host-capabilities", "claude-project-summary"].includes(options.command)) {
      const helperByCommand = {
        scan: [".looppilot/scripts/scan-summary.mjs", "Scan helper"],
        "host-capabilities": [".looppilot/scripts/host-capability-summary.mjs", "Host capability summary helper"],
        "claude-project-summary": [".looppilot/scripts/claude-project-summary.mjs", "Claude project summary helper"],
      };
      const targetRoot = path.resolve(options.cwd);
      assertDirectoryExists(targetRoot, "Project");
      const [relativeScriptPath, label] = helperByCommand[options.command];
      const scriptPath = path.join(targetRoot, relativeScriptPath);
      if (!fs.existsSync(scriptPath)) throw new Error(`${label} is missing: ${relativeScriptPath}`);
      const result = spawnSync(process.execPath, [scriptPath], { cwd: targetRoot, stdio: "inherit" });
      return result.status ?? 1;
    } else throw new Error(`Unknown command: ${options.command}`);
    return 0;
  } catch (error) {
    console.error(`LoopPilot error: ${error.message}`);
    return 1;
  }
}
