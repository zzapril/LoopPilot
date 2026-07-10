#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseIssueIntakeArgs } from "../.looppilot/scripts/issue-intake.mjs";

const cli = path.resolve("scripts/looppilot.mjs");
const errors = [];
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-issue-intake-"));
const primaryToken = "ghp_primarytokenvalue000000000000000000";
const fallbackToken = "ghp_fallbacktokenvalue0000000000000000";

function issue(overrides = {}) {
  return {
    html_url: "https://github.com/acme/widgets/issues/123",
    state: "open",
    title: "Fix <img src=x onerror=alert(1)> widget retry bug\n## injected ghp_TITLESECRETSECRETSECRETSECRETSECRET",
    body: "Retry fails. See comments for repro. Related to #456. ```` github_pat_SECRETSECRETSECRETSECRETSECRET",
    labels: [{ name: "bug\n- injected" }, "[unsafe](javascript:alert(1))", "npm_LABELSECRETSECRETSECRETSECRET"],
    user: { login: "octocat" },
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-02T00:00:00Z",
    comments: 2,
    ...overrides,
  };
}

function startMockServer(routes, requestLog) {
  const server = http.createServer((req, res) => {
    requestLog.push({ url: req.url, headers: req.headers });
    const route = routes[req.url];
    if (!route) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: `unexpected path ${req.url}` }));
      return;
    }
    const [status, body, headers = {}] = route;
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

function run(args, baseUrl, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LOOPPILOT_GITHUB_API_BASE_URL: baseUrl,
        GITHUB_TOKEN: "",
        GH_TOKEN: "",
        ...env,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ status: 1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

try {
  parseIssueIntakeArgs(["--repo", "acme/widgets", "--repo", "other/repo", "--number", "1"]);
  errors.push("direct issue-intake parser accepted a duplicate --repo option");
} catch (error) {
  assert(error.message.includes("Duplicate option: --repo."), `direct duplicate option returned the wrong error: ${error.message}`);
}

function assertNoHeavyEndpoints(requestLog, label) {
  for (const request of requestLog) {
    if (/\/(comments|timeline|pulls|attachments|logs)(\/|$)/.test(request.url)) {
      errors.push(`${label}: called forbidden heavy endpoint ${request.url}`);
    }
  }
}

async function withServer(routes, callback) {
  const requestLog = [];
  const { server, baseUrl } = await startMockServer(routes, requestLog);
  try {
    await callback(baseUrl, requestLog);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

await withServer({
  "/repos/acme/widgets/issues/123": [200, issue()],
}, async (baseUrl, requestLog) => {
  const result = await run(["issue-intake", "--url", "https://github.com/acme/widgets/issues/123"], baseUrl);
  assert(result.status === 0, `markdown success failed: ${result.stderr || result.stdout}`);
  assert(result.stdout.includes("# LoopPilot GitHub Issue Intake"), "markdown output missing title");
  assert(result.stdout.includes("possibly_incomplete"), "markdown output missing possibly_incomplete");
  assert(result.stdout.includes("issue_has_comments"), "markdown output missing comment warning");
  assert(result.stdout.includes("body_references_external_context"), "markdown output missing body context warning");
  assert(!result.stdout.includes("github_pat_SECRET"), "markdown output leaked GitHub token-like value");
  assert(!result.stdout.includes("ghp_TITLE"), "markdown output leaked title token-like value");
  assert(!result.stdout.includes("npm_LABEL"), "markdown output leaked label token-like value");
  assert(!result.stdout.includes("\n## injected"), "markdown output allowed title to inject heading structure");
  assert(!result.stdout.includes("\n- injected"), "markdown output allowed label to inject list structure");
  assert(!result.stdout.includes("<img"), "markdown output allowed raw HTML from an issue title");
  assert(!result.stdout.includes("[unsafe](javascript:"), "markdown output allowed a label to inject a Markdown link");
  assert(result.stdout.includes("`````text"), "markdown output did not choose a safe dynamic code fence");
  assert(requestLog.length === 1, `markdown success expected 1 request, saw ${requestLog.length}`);
  assert(requestLog[0]?.url === "/repos/acme/widgets/issues/123", `markdown success called ${requestLog[0]?.url}`);
  assert(!requestLog[0]?.headers.authorization, "public request unexpectedly sent authorization");
  assert(requestLog[0]?.headers.accept === "application/vnd.github+json", "missing GitHub accept header");
  assert(requestLog[0]?.headers["x-github-api-version"] === "2022-11-28", "missing GitHub API version header");
  assertNoHeavyEndpoints(requestLog, "markdown success");
});

await withServer({
  "/repos/acme/widgets/issues/123": [200, issue({
    html_url: "https://github.com/acme/widgets/issues/123\n## injected-url",
    comments: -1,
    body: "Plain issue body",
    created_at: "2026-06-01T00:00:00Z\n## injected-date",
  })],
}, async (baseUrl, requestLog) => {
  const result = await run(["issue-intake", "--repo", "acme/widgets", "--number", "123", "--json"], baseUrl, {
    GITHUB_TOKEN: primaryToken,
    GH_TOKEN: fallbackToken,
  });
  assert(result.status === 0, `json success failed: ${result.stderr || result.stdout}`);
  if (result.status !== 0) return;
  const parsed = JSON.parse(result.stdout);
  assert(parsed.schema_version === "1.0", "json schema_version mismatch");
  assert(parsed.artifact === "github_issue_intake", "json artifact mismatch");
  assert(parsed.read_mode === "issue_only", "json read_mode mismatch");
  assert(parsed.source.repo === "acme/widgets", "json repo mismatch");
  assert(parsed.source.number === 123, "json issue number mismatch");
  assert(!parsed.source.title.includes("ghp_TITLE"), "json title leaked token-like value");
  assert(!parsed.source.labels.some((label) => label.includes("npm_LABEL")), "json labels leaked token-like value");
  assert(!parsed.source.title.includes("\n"), "json title was not normalized to one line");
  assert(!parsed.source.labels.some((label) => label.includes("\n")), "json labels were not normalized to one line");
  assert(!parsed.source.url.includes("\n"), "json URL was not normalized to one line");
  assert(parsed.source.url === "https://github.com/acme/widgets/issues/123", "json URL should be canonical and independent of response text");
  assert(!parsed.source.created_at.includes("\n"), "json created_at was not normalized to one line");
  assert(parsed.source.comments_count === 0, "json comments_count should be normalized to a non-negative integer");
  assert(parsed.context.status === "issue_only", "json should be issue_only when no warnings");
  assert(parsed.context.not_read.includes("linked_pull_requests"), "json not_read missing linked_pull_requests");
  assert(!requestLog[0]?.headers.authorization, "custom API base should not receive GITHUB_TOKEN authorization");
  assert(!result.stdout.includes(primaryToken) && !result.stderr.includes(primaryToken), "primary token leaked to output");
  assertNoHeavyEndpoints(requestLog, "json success");
});

await withServer({
  "/repos/acme/widgets/issues/123": [200, issue({ comments: 0, body: "Plain issue body" })],
}, async (baseUrl, requestLog) => {
  const result = await run(["issue-intake", "--repo", "acme/widgets", "--number", "123", "--json"], baseUrl, {
    GH_TOKEN: fallbackToken,
  });
  assert(result.status === 0, `GH_TOKEN fallback failed: ${result.stderr || result.stdout}`);
  if (result.status !== 0) return;
  assert(!requestLog[0]?.headers.authorization, "custom API base should not receive GH_TOKEN authorization");
  assert(!result.stdout.includes(fallbackToken) && !result.stderr.includes(fallbackToken), "fallback token leaked to output");
});

for (const [baseUrl, expected] of [
  ["https://evil.example.test", "may only point to https://api.github.com or a loopback test server"],
  ["http://example.com", "may only point to https://api.github.com or a loopback test server"],
]) {
  const result = await run(["issue-intake", "--repo", "acme/widgets", "--number", "123"], baseUrl, {
    GITHUB_TOKEN: primaryToken,
  });
  assert(result.status !== 0, `${baseUrl} should fail before making a request`);
  assert(result.stderr.includes(expected), `${baseUrl} expected ${expected}, got ${result.stderr.trim()}`);
  assert(!result.stdout.includes(primaryToken) && !result.stderr.includes(primaryToken), `${baseUrl} leaked token to output`);
}

await withServer({
  "/repos/acme/widgets/issues/124": [200, issue({
    html_url: "https://github.com/acme/widgets/issues/124",
    comments: 0,
    body: `${"a".repeat(30050)} npm_SECRETSECRETSECRETSECRETSECRET`,
  })],
}, async (baseUrl) => {
  const result = await run(["issue-intake", "--repo", "acme/widgets", "--number", "124", "--json"], baseUrl);
  assert(result.status === 0, `truncation success failed: ${result.stderr || result.stdout}`);
  if (result.status !== 0) return;
  const parsed = JSON.parse(result.stdout);
  assert(parsed.body_truncated === true, "long body was not marked truncated");
  assert(parsed.context.status === "possibly_incomplete", "truncated body should make context possibly_incomplete");
  assert(parsed.context.warnings.includes("body_truncated"), "truncated body warning missing");
  assert(parsed.issue_body_redacted.length === 30000, "truncated body length mismatch");
  assert(!parsed.issue_body_redacted.includes("npm_SECRET"), "truncated body leaked npm token-like value");
});

await withServer({
  "/repos/acme/widgets/issues/126": [200, issue({
    html_url: "https://github.com/acme/widgets/issues/126",
    comments: 0,
    body: "看评论里的截图再处理",
  })],
}, async (baseUrl, requestLog) => {
  const result = await run(["issue-intake", "--url", "https://github.com/acme/widgets/issues/126#issuecomment-1", "--json"], baseUrl);
  assert(result.status === 0, `comment anchor success failed: ${result.stderr || result.stdout}`);
  if (result.status !== 0) return;
  const parsed = JSON.parse(result.stdout);
  assert(parsed.context.status === "possibly_incomplete", "comment anchor should make context possibly_incomplete");
  assert(parsed.context.warnings.includes("url_references_comment"), "comment anchor warning missing");
  assert(parsed.context.warnings.includes("body_references_external_context"), "Chinese external context warning missing");
  assert(requestLog.length === 1, `comment anchor expected 1 request, saw ${requestLog.length}`);
  assert(requestLog[0]?.url === "/repos/acme/widgets/issues/126", `comment anchor called ${requestLog[0]?.url}`);
  assertNoHeavyEndpoints(requestLog, "comment anchor");
});

await withServer({
  "/repos/acme/widgets/issues/127": [200, issue({
    html_url: "https://github.com/acme/widgets/issues/127",
    title: "Fix from screenshot in comments",
    comments: 0,
    body: "Plain issue body",
  })],
}, async (baseUrl) => {
  const result = await run(["issue-intake", "--repo", "acme/widgets", "--number", "127", "--json"], baseUrl);
  assert(result.status === 0, `title context success failed: ${result.stderr || result.stdout}`);
  if (result.status !== 0) return;
  const parsed = JSON.parse(result.stdout);
  assert(parsed.context.status === "possibly_incomplete", "title external context should make context possibly_incomplete");
  assert(parsed.context.warnings.includes("title_references_external_context"), "title external context warning missing");
});

await withServer({
  "/repos/acme/widgets/issues/125": [200, issue({ pull_request: { url: "https://api.github.com/repos/acme/widgets/pulls/125" } })],
}, async (baseUrl) => {
  const result = await run(["issue-intake", "--repo", "acme/widgets", "--number", "125"], baseUrl);
  assert(result.status !== 0, "PR-shaped issue response should fail");
  assert(result.stderr.includes("issue-intake accepts GitHub issues, not pull requests"), "PR-shaped issue response had wrong error");
});

for (const [status, expected] of [
  [401, "token is invalid"],
  [403, "permission denied or rate limited"],
  [404, "issue/repo not found"],
  [410, "issue is gone"],
  [429, "rate limited"],
]) {
  await withServer({
    "/repos/acme/widgets/issues/123": [status, { message: "mock failure" }, { "x-ratelimit-reset": "1780000000" }],
  }, async (baseUrl) => {
    const result = await run(["issue-intake", "--repo", "acme/widgets", "--number", "123"], baseUrl);
    assert(result.status !== 0, `status ${status} should fail`);
    assert(result.stderr.includes(expected), `status ${status} expected ${expected}, got ${result.stderr.trim()}`);
  });
}

await withServer({
  "/repos/acme/widgets/issues/123": [200, issue({ body: "first" })],
  "/repos/acme/widgets/issues/124": [200, issue({ html_url: "https://github.com/acme/widgets/issues/124", body: "second" })],
}, async (baseUrl, requestLog) => {
  const issueOutsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "looppilot-issue-output-outside-"));
  fs.symlinkSync(issueOutsideDir, path.join(tmpRoot, "linked-output"), process.platform === "win32" ? "junction" : "dir");
  const requestsBeforeUnsafeOutputs = requestLog.length;
  const linkedOutput = await run([
    "issue-intake", "--repo", "acme/widgets", "--number", "123", "--cwd", tmpRoot, "--output", "linked-output/intake.md",
  ], baseUrl);
  assert(linkedOutput.status !== 0, "issue-intake output through a symlinked directory should fail");
  assert(linkedOutput.stderr.includes("symbolic link path component"), "issue-intake symlink output returned the wrong error");
  assert(!fs.existsSync(path.join(issueOutsideDir, "intake.md")), "issue-intake output escaped the project through a symlink");

  fs.symlinkSync(issueOutsideDir, path.join(tmpRoot, "..linked-issue"), process.platform === "win32" ? "junction" : "dir");
  const dotdotLinkedOutput = await run([
    "issue-intake", "--repo", "acme/widgets", "--number", "123", "--cwd", tmpRoot, "--output", "..linked-issue/intake.md",
  ], baseUrl);
  assert(dotdotLinkedOutput.status !== 0, "issue-intake '..' prefix symlink output should fail");
  assert(dotdotLinkedOutput.stderr.includes("symbolic link path component"), "issue-intake '..' prefix symlink returned the wrong error");

  const protectedOutput = await run([
    "issue-intake", "--repo", "acme/widgets", "--number", "123", "--cwd", tmpRoot, "--output", ".looppilot/core/intake.md",
  ], baseUrl);
  assert(protectedOutput.status !== 0, "issue-intake should reject Agent Pack output paths");
  assert(protectedOutput.stderr.includes("refuses to overwrite Agent Pack file"), "issue-intake protected output returned the wrong error");

  const dependencyOutput = await run([
    "issue-intake", "--repo", "acme/widgets", "--number", "123", "--cwd", tmpRoot, "--output", "package-lock.json",
  ], baseUrl);
  assert(dependencyOutput.status !== 0, "issue-intake should reject dependency metadata outputs");
  assert(dependencyOutput.stderr.includes("refuses to overwrite dependency metadata"), "issue-intake dependency output returned the wrong error");

  const sensitiveOutput = await run([
    "issue-intake", "--repo", "acme/widgets", "--number", "123", "--cwd", tmpRoot, "--output", ".env.intake",
  ], baseUrl);
  assert(sensitiveOutput.status !== 0, "issue-intake should reject sensitive output paths");
  assert(sensitiveOutput.stderr.includes("refuses to write a sensitive path"), "issue-intake sensitive output returned the wrong error");
  assert(requestLog.length === requestsBeforeUnsafeOutputs, "unsafe issue-intake outputs should fail before network access");
  fs.rmSync(issueOutsideDir, { recursive: true, force: true });

  const outputPath = path.join(tmpRoot, "intake.md");
  const first = await run(["issue-intake", "--repo", "acme/widgets", "--number", "123", "--output", outputPath], baseUrl);
  assert(first.status === 0, `output write failed: ${first.stderr || first.stdout}`);
  assert(fs.existsSync(outputPath), "output file was not written");

  const duplicate = await run(["issue-intake", "--repo", "acme/widgets", "--number", "123", "--output", outputPath], baseUrl);
  assert(duplicate.status !== 0, "duplicate output should fail without --force");
  assert(duplicate.stderr.includes("already exists"), "duplicate output error missing already exists");

  const dryRunPath = path.join(tmpRoot, "dry-run.md");
  const dryRun = await run(["issue-intake", "--repo", "acme/widgets", "--number", "123", "--output", dryRunPath, "--dry-run"], baseUrl);
  assert(dryRun.status === 0, `dry-run failed: ${dryRun.stderr || dryRun.stdout}`);
  assert(!fs.existsSync(dryRunPath), "dry-run wrote a file");

  const force = await run(["issue-intake", "--repo", "acme/widgets", "--number", "124", "--output", outputPath, "--force"], baseUrl);
  assert(force.status === 0, `force overwrite failed: ${force.stderr || force.stdout}`);
  assert(fs.readFileSync(outputPath, "utf8").includes("#124"), "force overwrite did not update output");
});

for (const [args, expected] of [
  [["issue-intake", "--url", "https://github.com/acme/widgets/pull/12"], "issue-intake accepts GitHub issues, not pull requests"],
  [["issue-intake", "--url", "https://example.com/acme/widgets/issues/12"], "must use github.com"],
  [["issue-intake", "--url", "http://github.com/acme/widgets/issues/12"], "must use https"],
  [["issue-intake", "--url", "ftp://github.com/acme/widgets/issues/12"], "must use https"],
  [["issue-intake", "--url", "https://user:pass@github.com/acme/widgets/issues/12"], "must not contain credentials"],
  [["issue-intake", "--url", "https://github.com:444/acme/widgets/issues/12"], "must not use a non-standard port"],
  [["issue-intake", "--repo", "bad", "--number", "12"], "must look like owner/name"],
  [["issue-intake", "--repo", "acme/widgets", "--number", "abc"], "must be a positive integer"],
  [["issue-intake", "--repo", "acme/widgets", "--number", "0"], "must be a positive integer"],
  [["issue-intake", "--repo", "acme/widgets", "--number", "012"], "must be a positive integer"],
  [["issue-intake", "--repo", "acme/widgets", "--number", "9007199254740992"], "exceeds the safe integer range"],
  [["issue-intake", "--url", "https://github.com/acme/widgets/issues/12/extra"], "must look like"],
]) {
  const result = await run(args, "http://127.0.0.1:1");
  assert(result.status !== 0, `${args.join(" ")} should fail`);
  assert(result.stderr.includes(expected), `${args.join(" ")} expected ${expected}, got ${result.stderr.trim()}`);
}

fs.rmSync(tmpRoot, { recursive: true, force: true });

if (errors.length > 0) {
  console.error("LoopPilot issue intake validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("LoopPilot issue intake validation passed.");
