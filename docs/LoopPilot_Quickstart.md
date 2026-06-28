# LoopPilot Quickstart

LoopPilot should feel like a safety button inside Claude Code or Codex: install once, then ask whether a task should loop.

Current repository version: `@looppilot/cli@0.2.2`.

Latest published npm version: `@looppilot/cli@0.2.2`.

## 1. Install Once

Install:

```bash
npx @looppilot/cli@0.2.2 install
```

The default install target is both Codex and Claude Code for the current project. Advanced users can still override target, scope, cwd, force, or dry-run behavior with `looppilot help advanced`.

## 2. Ask In The Agent

Claude Code:

```text
/should-loop <task-or-issue-url>
```

Codex:

```text
Use LoopPilot on <task-or-issue-url>
```

Examples:

```text
/should-loop fix lint errors until npm test passes
Use LoopPilot on https://github.com/owner/repo/issues/123
```

LoopPilot returns one of three outcomes before loop-like execution:

- `NO_GO`: too risky or outside the safe surface.
- `PLAN_ONLY`: write a plan or ask for confirmation before execution.
- `RUN_WITH_CONTRACT`: execute only within the stated bounds, gate, stop conditions, and forbidden actions.

## 3. Verify If Needed

If install looks wrong, run:

```bash
npx @looppilot/cli@0.2.2 doctor
```

`doctor` checks installed files, fixture/schema compatibility, wrapper references, wrapper parity, and installed file hashes. It does not run a loop.

## GitHub Issue URLs

For issue URLs, the installed helper returns stable JSON to the current agent. It reads only the single issue title, body, labels, state, author, timestamps, URL, and comments count. It does not read comments, linked pull requests, attachments, logs, timeline events, or issue lists.

If comments, a comment anchor URL, a truncated body, or issue text suggest omitted context, LoopPilot marks the packet as `possibly_incomplete`. The current agent should default to `PLAN_ONLY` unless the user explicitly confirms continuing with incomplete context or approves reading more context.

Public issues do not require a token. For private repositories or higher rate limits, set `GITHUB_TOKEN` or `GH_TOKEN`; LoopPilot sends the token only to GitHub and never prints or saves it.

## Advanced / Debug

Most users should not run these manually. They are available for debugging, explicit handoff, and human-requested durable files:

```bash
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

Default explicit artifact paths:

```text
.looppilot/latest-contract.md
.looppilot/latest-report.md
.looppilot/latest-review-gate.md
.looppilot/VISION.md
.looppilot/STATE.md
.looppilot/RUN_LOG.md
```

These commands are not the main product flow. They do not create a runner, queue, provider registry, automatic commit/push/deploy path, or GitHub write workflow.
