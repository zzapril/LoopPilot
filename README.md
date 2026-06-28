# LoopPilot

LoopPilot is a safety decision layer for Codex and Claude Code. Install it once, then ask your current agent whether a task should loop.

It is not a background issue-fixing robot. It does not create branches, commits, pull requests, GitHub comments, queues, deploys, package publishes, or hidden runner state.

## Quickstart

Current repository version: `@looppilot/cli@0.2.1`.

Latest published npm version: `@looppilot/cli@0.2.0` until `0.2.1` is published.

Install the Agent Pack in your project with the latest published package:

```bash
npx @looppilot/cli@0.2.0 install
```

After `0.2.1` is published, the recommended explicit-version command becomes:

```bash
npx @looppilot/cli@0.2.1 install
```

Then ask inside your current agent session:

```text
Claude Code: /should-loop <task-or-issue-url>
Codex: Use LoopPilot on <task-or-issue-url>
```

Optional install check today:

```bash
npx @looppilot/cli@0.2.0 doctor
```

For the short task flow, see [LoopPilot Quickstart](docs/LoopPilot_Quickstart.md). For product, technical, release, and planning docs, see [LoopPilot Docs](docs/README.md).

## What It Does

LoopPilot gives the current agent a shared safety protocol:

- It classifies candidate loop tasks as `NO_GO`, `PLAN_ONLY`, or `RUN_WITH_CONTRACT`.
- It keeps execution agent-native: Codex or Claude Code decides and acts in the current session.
- It reads GitHub issue URLs through a narrow, read-only helper when the agent needs issue context.
- It treats issue text as untrusted context and marks `possibly_incomplete` when omitted comments, comment anchors, truncation, or external-context hints may matter.
- It refuses to become a runner, provider registry, scheduler, GitHub issue queue, deployer, or auto-push workflow.

For GitHub issue URLs, the installed wrapper may call `.looppilot/scripts/issue-intake.mjs` or the debug CLI command `looppilot issue-intake`. The helper reads only the single issue title, body, labels, state, author, timestamps, URL, and comments count. It does not read comments, linked pull requests, attachments, logs, timeline events, or issue lists.

## How It Differs From Coding Agents

LoopPilot is not trying to replace GitHub Copilot coding agent, OpenHands, or SWE-agent.

| Project type | Typical behavior | LoopPilot boundary |
|---|---|---|
| GitHub Copilot coding agent | Assign an issue/task to a cloud agent that can inspect the repo, make changes, and open a pull request | LoopPilot does not create branches, commits, pull requests, or GitHub comments |
| OpenHands-style issue resolver | Trigger an agent from labels/comments or a web/cloud workspace to work on issues | LoopPilot does not watch labels, scan queues, or run as a background resolver |
| SWE-agent-style autonomous issue fixer | Run an agent loop against a GitHub issue and inspect trajectories/results | LoopPilot only prepares a safe decision and contract for the current Codex or Claude Code session |

The useful idea to borrow from those projects is auditability, not automation. A future LoopPilot `trajectory-lite` artifact may record user-visible facts such as the input, context read, incomplete-context warnings, final decision, requested confirmation, proposed gate, and command/result summaries. It must not record hidden model reasoning, and it is not required for the current release-ready surface.

## Advanced / Debug

Most users should not need these commands. They exist for install validation, debugging, and explicit handoff/artifact workflows:

```bash
looppilot doctor
looppilot help advanced
looppilot issue-intake --url https://github.com/owner/repo/issues/123 --json
looppilot scan
looppilot host-capabilities
looppilot claude-project-summary
looppilot export --target codex
looppilot export --target claude
looppilot export --target github-issue
looppilot save-contract --from /path/to/contract.md
looppilot save-report --from /path/to/report.md
looppilot save-review-gate --from /path/to/review-gate.md
looppilot save-vision --from /path/to/vision.md
looppilot save-state --from /path/to/state.md
looppilot save-run-log --from /path/to/run-log.md
```

The `save-*` commands write files only when explicitly requested by a human. Default explicit artifact paths include:

```text
.looppilot/latest-contract.md
.looppilot/latest-report.md
.looppilot/latest-review-gate.md
.looppilot/VISION.md
.looppilot/STATE.md
.looppilot/RUN_LOG.md
```

These files are not runner state, approval gates, deployment gates, release gates, or permission to merge/push/deploy.

## Current Implementation Status

Implemented:

- Shared LoopPilot core rules, decision schema, contract template, report/export templates, and v1 manual artifact templates including review gates.
- 45 decision fixtures: 15 `NO_GO`, 15 `PLAN_ONLY`, and 15 `RUN_WITH_CONTRACT`.
- Codex and Claude Code wrappers that reference the same shared core.
- Claude Code `should-loop` command alias that points to the Claude skill without duplicating rules.
- Agent-native GitHub issue URL intake for Codex and Claude Code, backed by a read-only issue-intake helper.
- Validation scripts for fixtures, runtime JSON Schema checks, schema drift, wrapper references, wrapper parity, scan safety, export behavior, save commands, docs consistency, package contents, and install/doctor integration.

Not implemented by design:

- No loop runner.
- No background daemon.
- No model provider registry.
- No scheduled loop platform or GitHub issue queue.
- No automatic commit, push, deploy, publish, dependency installation, issue closing, PR creation, or GitHub write action.

## Validate This Repo

```bash
npm test
npm run eval:wrapper-parity
node scripts/looppilot.mjs doctor --target both --json
env npm_config_cache=/private/tmp/looppilot-npm-cache npm pack --dry-run
git diff --check
```
