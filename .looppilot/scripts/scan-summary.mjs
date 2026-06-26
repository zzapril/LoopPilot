#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const maxDepth = 6;
const maxEntries = 5000;
const sensitivePatterns = [
  /(^|\/)\.env(?:\..*)?$/,
  /(^|\/)[^/]+\.pem$/,
  /(^|\/)[^/]+\.key$/,
  /(^|\/)secrets(\/|$)/,
  /(^|\/)\.ssh(\/|$)/,
  /(^|\/)\.aws(\/|$)/,
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

function isSensitive(relativePath) {
  const normalized = relativePath.replaceAll(path.sep, "/");
  return sensitivePatterns.some((pattern) => pattern.test(normalized));
}

function shouldSkipDirectory(relativePath) {
  const normalized = relativePath.replaceAll(path.sep, "/");
  return normalized === ".git" || normalized === "node_modules" || normalized.endsWith("/node_modules");
}

function walkPathCandidates() {
  const found = [];
  const pending = [{ absolutePath: root, relativePath: "", depth: 0 }];
  let visitedEntries = 0;

  while (pending.length > 0 && visitedEntries < maxEntries) {
    const current = pending.shift();
    let entries;
    try {
      entries = fs.readdirSync(current.absolutePath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (visitedEntries >= maxEntries) break;
      const relativePath = current.relativePath ? path.join(current.relativePath, entry.name) : entry.name;
      if (shouldSkipDirectory(relativePath)) continue;

      found.push(relativePath);
      visitedEntries += 1;

      if (entry.isDirectory() && current.depth < maxDepth) {
        pending.push({
          absolutePath: path.join(current.absolutePath, entry.name),
          relativePath,
          depth: current.depth + 1,
        });
      }
    }
  }

  return found;
}

function rootFileNames(pathCandidates) {
  return pathCandidates.filter((name) => !name.includes(path.sep) && !name.includes("/"));
}

function safeRootFiles(pathCandidates) {
  return rootFileNames(pathCandidates).filter((name) => !isSensitive(name));
}

function sensitivePathCandidates(pathCandidates) {
  return pathCandidates.filter(isSensitive);
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
  if (fileExists("package.json")) tests.push("npm test");
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
const pathCandidates = walkPathCandidates();
const rootFiles = safeRootFiles(pathCandidates);
const sensitiveFiles = sensitivePathCandidates(pathCandidates);
const commands = candidateCommands();
const allPathCandidates = [...changedFiles, ...rootFiles];
const readmeTitle = fileExists("README.md") ? "README.md" : null;

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
    risk_paths: [...new Set(allPathCandidates.filter((name) => riskPathPattern.test(name.replaceAll(path.sep, "/"))))],
    sensitive_candidates: [...new Set([...allPathCandidates.filter(isSensitive), ...sensitiveFiles])],
  },
};

console.log(JSON.stringify(summary, null, 2));
