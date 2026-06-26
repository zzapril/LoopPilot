#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJsonFile, readJsonlFile, validateFixtureSet } from "./lib/decision-validator.mjs";
import { validateDecisionAgainstSchema, validateDecisionSchemaDefinition } from "./lib/schema-validator.mjs";
import { validateWrappers } from "./lib/wrapper-validator.mjs";
import { validateWrapperParity } from "./validate-wrapper-parity.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const coreFiles = [
  ".looppilot/core/qualification-rules.md",
  ".looppilot/core/decision-schema.json",
  ".looppilot/core/contract-template.md",
  ".looppilot/core/export-template-codex.md",
  ".looppilot/core/export-template-claude.md",
  ".looppilot/core/export-template-github-issue.md",
  ".looppilot/core/report-template.md",
  ".looppilot/fixtures/decision-fixtures.jsonl",
  ".looppilot/scripts/scan-summary.mjs",
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

Usage:
  looppilot install [--target both|codex|claude] [--scope project] [--cwd <path>] [--force] [--dry-run]
  looppilot doctor [--target both|codex|claude] [--cwd <path>] [--json] [--output <path>]
  looppilot export --target codex|claude|github-issue [--cwd <path>] [--output <path>] [--force] [--dry-run]
  looppilot save-contract --from <path> [--cwd <path>] [--output <path>] [--force] [--dry-run]
  looppilot save-report --from <path> [--cwd <path>] [--output <path>] [--force] [--dry-run]
  looppilot scan [--cwd <path>]

Notes:
  install copies the Agent Pack only. It does not run loops.
  doctor checks installed Agent Pack files, fixtures, and wrappers.
  export writes handoff files only when explicitly requested. It does not execute loops.
  save-contract and save-report write latest files only when explicitly requested.
  scan prints a read-only repository evidence summary.
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
    output: null,
    from: null,
    json: false,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--target") options.target = rest[++index];
    else if (arg === "--scope") options.scope = rest[++index];
    else if (arg === "--cwd") options.cwd = rest[++index];
    else if (arg === "--output") options.output = rest[++index];
    else if (arg === "--from") options.from = rest[++index];
    else if (arg === "--json") options.json = true;
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

function exportTemplateForTarget(target) {
  if (target === "codex") return [".looppilot/core/export-template-codex.md", ".looppilot/exports/RUN_IN_CODEX.md"];
  if (target === "claude") return [".looppilot/core/export-template-claude.md", ".looppilot/exports/RUN_IN_CLAUDE.md"];
  if (target === "github-issue") return [".looppilot/core/export-template-github-issue.md", ".looppilot/exports/github-issue.md"];
  throw new Error(`Unsupported export target: ${target}`);
}

function exportHandoff(options) {
  if (!["codex", "claude", "github-issue"].includes(options.target)) {
    throw new Error("Export requires --target codex, claude, or github-issue.");
  }
  const targetRoot = path.resolve(options.cwd);
  const [templatePath, defaultOutputPath] = exportTemplateForTarget(options.target);
  const source = path.join(targetRoot, templatePath);
  if (!fs.existsSync(source)) throw new Error(`Export template is missing: ${templatePath}`);

  const outputPath = path.resolve(targetRoot, options.output ?? defaultOutputPath);
  if (fs.existsSync(outputPath) && !options.force) {
    throw new Error(`${path.relative(targetRoot, outputPath)} already exists. Re-run with --force to overwrite.`);
  }

  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(source, outputPath);
  }

  console.log("LoopPilot export completed.");
  console.log(`Target: ${options.target}`);
  console.log(`Output: ${path.relative(targetRoot, outputPath)}`);
  if (options.dryRun) console.log("Dry run: no file written.");
}

function saveExplicitFile(options, kind) {
  const targetRoot = path.resolve(options.cwd);
  if (!options.from) throw new Error(`${kind} requires --from <path>.`);
  const source = path.resolve(targetRoot, options.from);
  if (!fs.existsSync(source)) throw new Error(`Source file is missing: ${path.relative(targetRoot, source)}`);

  const defaultOutput = kind === "contract" ? ".looppilot/latest-contract.md" : ".looppilot/latest-report.md";
  const outputPath = path.resolve(targetRoot, options.output ?? defaultOutput);
  if (fs.existsSync(outputPath) && !options.force) {
    throw new Error(`${path.relative(targetRoot, outputPath)} already exists. Re-run with --force to overwrite.`);
  }

  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(source, outputPath);
  }

  console.log(`LoopPilot save-${kind} completed.`);
  console.log(`Source: ${path.relative(targetRoot, source)}`);
  console.log(`Output: ${path.relative(targetRoot, outputPath)}`);
  if (options.dryRun) console.log("Dry run: no file written.");
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

function getPackageMetadata() {
  const packageJson = readJsonFile(path.join(packageRoot, "package.json"));
  return {
    packageName: packageJson.name ?? null,
    packageVersion: packageJson.version ?? null,
  };
}

function doctor(options) {
  const startedAt = process.hrtime.bigint();
  const targetRoot = path.resolve(options.cwd);
  const files = filesForTarget(options.target);
  const errors = [];
  const checks = [];
  const { packageName, packageVersion } = getPackageMetadata();
  let fixtureSummary = { total: 0, counts: { NO_GO: 0, PLAN_ONLY: 0, RUN_WITH_CONTRACT: 0 } };

  function recordCheck(name, checkErrors) {
    checks.push({ name, passed: checkErrors.length === 0, errors: checkErrors });
    errors.push(...checkErrors);
  }

  const missing = checkFilesExist(targetRoot, files);
  recordCheck("pack files", missing.map((file) => `${file}: missing`));

  if (missing.length === 0) {
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
      recordCheck("codex wrapper", wrapperResult.errors.filter((error) => error.startsWith(".agents/")));
    }
    if (options.target === "claude") {
      recordCheck("claude wrapper", wrapperResult.errors.filter((error) => error.startsWith(".claude/")));
    }
  }

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  const report = {
    ok: errors.length === 0,
    target: options.target,
    project: targetRoot,
    commit: getShortCommit(targetRoot),
    package_name: packageName,
    package_version: packageVersion,
    fixture_total: fixtureSummary.total,
    fixture_counts: fixtureSummary.counts,
    wrapper_files: wrapperFilesByTarget[options.target],
    core_files: coreFiles,
    duration_ms: Math.round(durationMs),
    checks,
  };

  if (options.json) {
    const output = JSON.stringify(report, null, 2);
    if (options.output) {
      const outputPath = path.resolve(targetRoot, options.output);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${output}\n`);
    } else if (errors.length > 0) console.error(output);
    else console.log(output);
  } else if (errors.length > 0) {
    console.error("LoopPilot doctor failed:");
    for (const error of errors) console.error(`- ${error}`);
  } else {
    console.log("LoopPilot doctor passed.");
    console.log(`Target: ${options.target}`);
    console.log(`Project: ${targetRoot}`);
    for (const check of checks) {
      console.log(`- ${check.passed ? "PASS" : "FAIL"}: ${check.name}`);
    }
  }

  if (errors.length > 0) process.exit(1);
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.command || options.help) {
    printHelp();
  } else if (options.command === "install") {
    install(options);
  } else if (options.command === "doctor") {
    doctor(options);
  } else if (options.command === "export") {
    exportHandoff(options);
  } else if (options.command === "save-contract") {
    saveExplicitFile(options, "contract");
  } else if (options.command === "save-report") {
    saveExplicitFile(options, "report");
  } else if (options.command === "scan") {
    const targetRoot = path.resolve(options.cwd);
    const scriptPath = path.join(targetRoot, ".looppilot/scripts/scan-summary.mjs");
    if (!fs.existsSync(scriptPath)) throw new Error("Scan helper is missing: .looppilot/scripts/scan-summary.mjs");
    const result = spawnSync(process.execPath, [scriptPath], { cwd: targetRoot, stdio: "inherit" });
    process.exit(result.status ?? 1);
  } else {
    throw new Error(`Unknown command: ${options.command}`);
  }
} catch (error) {
  console.error(`LoopPilot error: ${error.message}`);
  process.exit(1);
}
