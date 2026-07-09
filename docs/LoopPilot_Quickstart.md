# LoopPilot Quickstart

LoopPilot should feel like a safety button inside Claude Code or Codex: install once, then ask whether a task should loop and which agent execution surface it should use.

Current repository version: `@looppilot/cli@0.3.0`.

Latest published npm version: `@looppilot/cli@0.2.4`.

## 1. Install Once

Recommended path:

```bash
npm install -g @looppilot/cli
looppilot install
looppilot doctor
```

The default install target is both Codex and Claude Code for the current project. Advanced users can still override target, scope, cwd, force, or dry-run behavior with `looppilot help advanced`.

For a one-off trial:

```bash
npx @looppilot/cli@0.2.4 install
npx @looppilot/cli@0.2.4 doctor
```

If `npx` keeps spinning, use the global install path above.

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

It also returns `recommended_surface`: `manual`, `plan`, `goal`, `loop`, or `routine`.

## Claude Code `/loop`

Claude Code `/loop` answers how to run a prompt again later. LoopPilot answers whether the task should enter a loop at all.

LoopPilot does not replace Claude Code `/loop`. It helps decide when `/loop` is the right surface, especially for safe tasks that need to wait for external state such as CI, deploy status, PR review, issue updates, or queue status. Local lint/test/typecheck fixes usually fit `recommended_surface: "goal"` instead.

## 3. Verify If Needed

If install looks wrong, run:

```bash
looppilot doctor
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
