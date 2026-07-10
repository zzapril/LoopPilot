#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const maxSensitiveWalkDepth = 3;
const maxSensitiveCandidates = 200;
const maxRiskPaths = 200;
const maxWalkEntries = 10000;
const ignoredScanDirectories = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", "vendor"]);
const sensitivePatterns = [
  /(^|\/)\.env(?:\..*)?$/,
  /(^|\/)\.(?:npmrc|pypirc|netrc)$/,
  /(^|\/)\.docker\/config\.json$/,
  /(^|\/)\.config\/gh\/hosts\.yml$/,
  /(^|\/)[^/]+\.pem$/,
  /(^|\/)[^/]+\.key$/,
  /^secrets(?:\/|$)/,
  /^\.ssh(?:\/|$)/,
  /^\.aws(?:\/|$)/,
];
const riskPathPattern = /(^|\/)(auth|payment|billing|checkout|permission|admin|production|deploy|infra|migration|db|database|secret|secrets)(?=\/|$|[._-])/i;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error?.code === "ENOENT") return { status: "unavailable", output: null };
  if (result.status !== 0) return { status: "failed", output: null };
  return { status: "ok", output: result.stdout };
}

function fileExists(name) {
  return fs.existsSync(path.join(root, name));
}

function readJson(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
  } catch {
    return null;
  }
}

function normalizePath(relativePath) {
  return relativePath.replaceAll(path.sep, "/");
}

function isSensitive(relativePath) {
  const normalized = normalizePath(relativePath);
  return sensitivePatterns.some((pattern) => pattern.test(normalized));
}

function rootEntries() {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.name !== ".git");
}

function rootFileNames() {
  return rootEntries().map((entry) => entry.name);
}

function safeRootFiles() {
  return rootFileNames().filter((name) => !isSensitive(name));
}

function sensitiveRootFiles() {
  return rootFileNames().filter(isSensitive);
}

function shouldSkipDirectory(name) {
  return ignoredScanDirectories.has(name);
}

function discoverPathEvidence() {
  const sensitiveCandidates = new Set(sensitiveRootFiles().map(normalizePath));
  const riskPaths = new Set();
  const discoveredPaths = [];
  const queue = rootEntries()
    .filter((entry) => entry.isDirectory() && !shouldSkipDirectory(entry.name))
    .map((entry) => ({ relativePath: entry.name, depth: 0 }));
  let cursor = 0;
  let inspectedEntries = 0;
  let truncated = false;

  for (const name of rootFileNames()) {
    const normalized = normalizePath(name);
    discoveredPaths.push(normalized);
    if (isSensitive(normalized) && sensitiveCandidates.size < maxSensitiveCandidates) sensitiveCandidates.add(normalized);
    if (riskPathPattern.test(normalized) && riskPaths.size < maxRiskPaths) riskPaths.add(normalized);
  }

  while (cursor < queue.length) {
    if (inspectedEntries >= maxWalkEntries) {
      truncated = true;
      break;
    }
    const current = queue[cursor++];
    if (current.depth >= maxSensitiveWalkDepth) continue;

    const absolutePath = path.join(root, current.relativePath);
    let entries;
    try {
      entries = fs.readdirSync(absolutePath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (inspectedEntries >= maxWalkEntries) {
        truncated = true;
        break;
      }
      inspectedEntries += 1;
      if (entry.isDirectory() && shouldSkipDirectory(entry.name)) continue;
      const child = path.join(current.relativePath, entry.name);
      const childNormalized = normalizePath(child);
      discoveredPaths.push(childNormalized);
      if (isSensitive(childNormalized) && sensitiveCandidates.size < maxSensitiveCandidates) sensitiveCandidates.add(childNormalized);
      if (riskPathPattern.test(childNormalized) && riskPaths.size < maxRiskPaths) riskPaths.add(childNormalized);
      if (entry.isDirectory()) queue.push({ relativePath: child, depth: current.depth + 1 });
    }
  }

  return {
    sensitiveCandidates: [...sensitiveCandidates],
    riskPaths: [...riskPaths],
    discoveredPaths,
    inspectedEntries,
    truncated,
  };
}

function changedFilesFromStatus(status) {
  if (!status) return [];
  const tokens = status.split("\0");
  const files = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const statusCode = token.slice(0, 2);
    const name = token.slice(3);
    if (name) files.push(name);
    if (/[RC]/.test(statusCode)) index += 1;
  }
  return files;
}

function candidateCommands() {
  const tests = [];
  const builds = [];
  const pkg = readJson("package.json");
  if (pkg?.scripts?.test) tests.push("npm test");
  if (pkg?.scripts?.build) builds.push("npm run build");
  if (fileExists("pyproject.toml")) tests.push("pytest");
  if (fileExists("go.mod")) {
    tests.push("go test ./...");
    builds.push("go build ./...");
  }
  if (fileExists("pom.xml")) tests.push("mvn test");
  return { tests: [...new Set(tests)], builds: [...new Set(builds)] };
}

function languages(files) {
  const found = [];
  if (fileExists("package.json") || files.some((file) => /\.(mjs|js|ts|tsx|jsx)$/.test(file))) found.push("javascript");
  if (fileExists("pyproject.toml") || files.some((file) => /\.py$/.test(file))) found.push("python");
  if (fileExists("go.mod") || files.some((file) => /\.go$/.test(file))) found.push("go");
  if (fileExists("pom.xml") || files.some((file) => /\.java$/.test(file))) found.push("java");
  return [...new Set(found)];
}

const statusResult = run("git", ["status", "--porcelain=v1", "-z"]);
const diffResult = statusResult.status === "ok" ? run("git", ["diff", "--stat"]) : { status: statusResult.status, output: null };
const changedFiles = changedFilesFromStatus(statusResult.output);
const rootFiles = safeRootFiles();
const pathEvidence = discoverPathEvidence();
const commands = candidateCommands();
const allPathCandidates = [...changedFiles, ...rootFiles, ...pathEvidence.discoveredPaths];
const readmeTitle = fileExists("README.md")
  ? fs.readFileSync(path.join(root, "README.md"), "utf8").split(/\n/).find((line) => line.startsWith("# ")) ?? null
  : null;

const summary = {
  repo: {
    git_status: statusResult.status,
    dirty: statusResult.status === "ok" ? statusResult.output.length > 0 : null,
    changed_files: changedFiles,
    diff_stat: diffResult.status === "ok" ? diffResult.output.trim() : null,
    readme_title: readmeTitle,
  },
  project: {
    languages: languages(allPathCandidates),
    test_commands: commands.tests,
    build_commands: commands.builds,
  },
  risk: {
    risk_paths: [...new Set([...allPathCandidates.filter((name) => riskPathPattern.test(normalizePath(name))).map(normalizePath), ...pathEvidence.riskPaths])].slice(0, maxRiskPaths),
    sensitive_candidates: [...new Set([...allPathCandidates.filter(isSensitive).map(normalizePath), ...pathEvidence.sensitiveCandidates])].slice(0, maxSensitiveCandidates),
    inspected_entries: pathEvidence.inspectedEntries,
    scan_truncated: pathEvidence.truncated,
  },
};

console.log(JSON.stringify(summary, null, 2));
