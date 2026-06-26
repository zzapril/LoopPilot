#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const maxSensitiveWalkDepth = 3;
const maxSensitiveCandidates = 200;
const sensitivePatterns = [
  /(^|\/)\.env(?:\..*)?$/,
  /(^|\/)[^/]+\.pem$/,
  /(^|\/)[^/]+\.key$/,
  /^secrets(?:\/|$)/,
  /^\.ssh(?:\/|$)/,
  /^\.aws(?:\/|$)/,
];
const riskPathPattern = /(^|\/)(auth|payment|billing|checkout|permission|admin|production|deploy|infra|migration|db|database|secret|secrets)(\/|$)/i;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) return "";
  return result.stdout.trim();
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

function rootFileNames() {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".git"))
    .map((entry) => entry.name);
}

function safeRootFiles() {
  return rootFileNames().filter((name) => !isSensitive(name));
}

function sensitiveRootFiles() {
  return rootFileNames().filter(isSensitive);
}

function discoverSensitiveCandidates() {
  const candidates = new Set(sensitiveRootFiles().map(normalizePath));
  const queue = rootFileNames()
    .filter((name) => name !== ".git")
    .map((name) => ({ relativePath: name, depth: 0 }));

  while (queue.length > 0 && candidates.size < maxSensitiveCandidates) {
    const current = queue.shift();
    const normalized = normalizePath(current.relativePath);
    if (isSensitive(normalized)) candidates.add(normalized);
    if (current.depth >= maxSensitiveWalkDepth) continue;

    const absolutePath = path.join(root, current.relativePath);
    let entries;
    try {
      entries = fs.readdirSync(absolutePath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name === ".git") continue;
      const child = path.join(current.relativePath, entry.name);
      const childNormalized = normalizePath(child);
      if (isSensitive(childNormalized)) candidates.add(childNormalized);
      if (entry.isDirectory()) queue.push({ relativePath: child, depth: current.depth + 1 });
      if (candidates.size >= maxSensitiveCandidates) break;
    }
  }

  return [...candidates];
}

function changedFilesFromStatus(status) {
  if (!status) return [];
  return status.split(/\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map((name) => name.includes(" -> ") ? name.split(" -> ").pop() : name);
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

const status = run("git", ["status", "--short"]);
const diffStat = run("git", ["diff", "--stat"]);
const changedFiles = changedFilesFromStatus(status);
const rootFiles = safeRootFiles();
const sensitiveFiles = discoverSensitiveCandidates();
const commands = candidateCommands();
const allPathCandidates = [...changedFiles, ...rootFiles];
const readmeTitle = fileExists("README.md")
  ? fs.readFileSync(path.join(root, "README.md"), "utf8").split(/\n/).find((line) => line.startsWith("# ")) ?? null
  : null;

const summary = {
  repo: {
    dirty: status.length > 0,
    changed_files: changedFiles,
    diff_stat: diffStat,
    readme_title: readmeTitle,
  },
  project: {
    languages: languages(allPathCandidates),
    test_commands: commands.tests,
    build_commands: commands.builds,
  },
  risk: {
    risk_paths: [...new Set(allPathCandidates.filter((name) => riskPathPattern.test(normalizePath(name))))],
    sensitive_candidates: [...new Set([...allPathCandidates.filter(isSensitive).map(normalizePath), ...sensitiveFiles])],
  },
};

console.log(JSON.stringify(summary, null, 2));
