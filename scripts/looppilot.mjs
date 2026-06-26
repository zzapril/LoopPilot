#!/usr/bin/env node
import crypto from "node:crypto";
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
  ".looppilot/core/vision-template.md",
  ".looppilot/core/state-template.md",
  ".looppilot/core/run-log-template.md",
  ".looppilot/core/review-gate-template.md",
  ".looppilot/fixtures/decision-fixtures.jsonl",
  ".looppilot/scripts/scan-summary.mjs",
  ".looppilot/scripts/claude-project-summary.mjs",
  ".looppilot/scripts/host-capability-summary.mjs",
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
  looppilot doctor [--target both|codex|claude] [--cwd <path>] [--json] [--output <path>] [--force] [--dry-run]
  looppilot export --target codex|claude|github-issue [--cwd <path>] [--output <path>] [--force] [--dry-run]
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
  save-* commands write manual artifacts only when explicitly requested.
  scan prints a read-only repository evidence summary.
  host-capabilities prints optional read-only host capability evidence.
  claude-project-summary prints optional read-only Claude project metadata only.
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

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--target") options.target = readOptionValue(arg, index++);
    else if (arg === "--scope") options.scope = readOptionValue(arg, index++);
    else if (arg === "--cwd") options.cwd = readOptionValue(arg, index++);
    else if (arg === "--output") options.output = readOptionValue(arg, index++);
    else if (arg === "--from") options.from = readOptionValue(arg, index++);
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

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
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
        sha256: sha256File(path.join(targetRoot, file)),
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

function doctor(options) {
  const startedAt = process.hrtime.bigint();
  const targetRoot = path.resolve(options.cwd);
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
    if (options.output) {
      const outputPath = path.resolve(targetRoot, options.output);
      if (fs.existsSync(outputPath) && !options.force) {
        console.error(`LoopPilot error: ${path.relative(targetRoot, outputPath)} already exists. Re-run with --force to overwrite.`);
        process.exit(1);
      }
      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, `${output}\n`, "utf8");
      }
      console.log(`LoopPilot doctor JSON report ${options.dryRun ? "would be written" : "written"}.`);
      console.log(`Output: ${path.relative(targetRoot, outputPath)}`);
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
  } else if (options.command === "save-vision") {
    saveExplicitFile(options, "vision");
  } else if (options.command === "save-state") {
    saveExplicitFile(options, "state");
  } else if (options.command === "save-run-log") {
    saveExplicitFile(options, "run-log");
  } else if (options.command === "save-review-gate") {
    saveExplicitFile(options, "review-gate");
  } else if (options.command === "scan") {
    const targetRoot = path.resolve(options.cwd);
    const scriptPath = path.join(targetRoot, ".looppilot/scripts/scan-summary.mjs");
    if (!fs.existsSync(scriptPath)) throw new Error("Scan helper is missing: .looppilot/scripts/scan-summary.mjs");
    const result = spawnSync(process.execPath, [scriptPath], { cwd: targetRoot, stdio: "inherit" });
    process.exit(result.status ?? 1);
  } else if (options.command === "host-capabilities") {
    const targetRoot = path.resolve(options.cwd);
    const scriptPath = path.join(targetRoot, ".looppilot/scripts/host-capability-summary.mjs");
    if (!fs.existsSync(scriptPath)) throw new Error("Host capability summary helper is missing: .looppilot/scripts/host-capability-summary.mjs");
    const result = spawnSync(process.execPath, [scriptPath], { cwd: targetRoot, stdio: "inherit" });
    process.exit(result.status ?? 1);
  } else if (options.command === "claude-project-summary") {
    const targetRoot = path.resolve(options.cwd);
    const scriptPath = path.join(targetRoot, ".looppilot/scripts/claude-project-summary.mjs");
    if (!fs.existsSync(scriptPath)) throw new Error("Claude project summary helper is missing: .looppilot/scripts/claude-project-summary.mjs");
    const result = spawnSync(process.execPath, [scriptPath], { cwd: targetRoot, stdio: "inherit" });
    process.exit(result.status ?? 1);
  } else {
    throw new Error(`Unknown command: ${options.command}`);
  }
} catch (error) {
  console.error(`LoopPilot error: ${error.message}`);
  process.exit(1);
}
