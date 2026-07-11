#!/usr/bin/env node
import fs from "node:fs";

const errors = [];

function read(file) {
  if (!fs.existsSync(file)) {
    errors.push(`${file}: missing`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function requireFragments(file, content, fragments) {
  for (const fragment of fragments) {
    if (!content.includes(fragment)) errors.push(`${file}: missing ${JSON.stringify(fragment)}`);
  }
}

function validatePinnedActions(file, content) {
  for (const match of content.matchAll(/^\s*uses:\s+([^\s#]+)(?:\s+#.*)?$/gm)) {
    const reference = match[1];
    const separator = reference.lastIndexOf("@");
    const revision = separator >= 0 ? reference.slice(separator + 1) : "";
    if (!/^[a-f0-9]{40}$/.test(revision)) {
      errors.push(`${file}: action must be pinned to a full commit SHA (${reference})`);
    }
  }
}

const ciFile = ".github/workflows/ci.yml";
const ci = read(ciFile);
requireFragments(ciFile, ci, [
  "workflow_dispatch:",
  "branches:\n      - main",
  "pull_request:",
  "permissions:\n  contents: read",
  "timeout-minutes: 20",
  "node-version: [22, 24, 26]",
  "npm ci",
  "npm test",
  "npm pack --dry-run",
]);
validatePinnedActions(ciFile, ci);

const publishFile = ".github/workflows/publish.yml";
const publish = read(publishFile);
requireFragments(publishFile, publish, [
  "tags:\n      - \"v*\"",
  "contents: read",
  "id-token: write",
  "environment: npm-publish",
  "timeout-minutes: 20",
  "package-manager-cache: false",
  "npm@11.18.0",
  "GITHUB_REF_NAME",
  "git merge-base --is-ancestor",
  "origin/main",
  "npm test",
  "already_published",
  "steps.registry.outputs.already_published != 'true'",
  "npm publish --access public",
]);
for (const forbidden of ["NPM_TOKEN", "NODE_AUTH_TOKEN", "secrets."]) {
  if (publish.includes(forbidden)) errors.push(`${publishFile}: token-based publishing reference is forbidden (${forbidden})`);
}
validatePinnedActions(publishFile, publish);

if (errors.length > 0) {
  console.error("LoopPilot workflow validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot workflow validation passed.");
