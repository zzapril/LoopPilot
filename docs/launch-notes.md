# Launch notes: explain LoopPilot as an agent-mode pre-flight check

Use this when posting about LoopPilot outside the repository. The goal is to explain the problem, not to lead with “I built a CLI.”

## Short positioning

AI agents are not incapable of working in loops. The hard question is when they should start, which surface they should use, and when they should stop.

LoopPilot is a small pre-flight check for Claude Code and Codex: before your agent starts changing files, it decides whether the task is `NO_GO`, `PLAN_ONLY`, or `RUN_WITH_CONTRACT`, then recommends `manual`, `plan`, `goal`, `loop`, or `routine`.

Claude Code `/loop` answers how to run a prompt again later. LoopPilot answers whether the task should enter a loop at all.

## Possible titles

- I built a tiny tool that tells your AI agent when **not** to loop
- Stop telling agents “just keep going”: add a pre-flight check first
- 别一上来就 `/goal`：我做了个 Agent 开工前检查工具
- 我做了个工具，专门劝 AI 别瞎跑

## Example post

I built LoopPilot, a tiny safety layer for Claude Code and Codex.

The point is not to replace coding agents. The point is to ask one question before they start changing files:

> Should this task enter a loop at all?

LoopPilot returns one of three answers:

- `NO_GO`: too risky or out of scope for a bounded loop.
- `PLAN_ONLY`: make a plan first; do not execute yet.
- `RUN_WITH_CONTRACT`: the task is narrow enough, has a gate, and has stop conditions.

It also recommends a surface:

- `goal` for local lint/test/typecheck loops.
- `loop` for safe tasks that wait on external state, such as CI or PR review.
- `routine` for recurring work after cadence, source, permissions, report format, and stop conditions are clear.

Example:

```text
/should-loop Fix lint until pnpm lint passes. Do not commit or push.
```

Output shape:

```text
RUN_WITH_CONTRACT
Surface: goal
Allowed: read files, edit lint-related code, run pnpm lint
Forbidden: commit, push, deploy, change secrets
Stop: lint passes, same failure twice, scope expands
```

This is intentionally an early project. It is not a background issue-fixing robot, not a deployer, and not a GitHub queue runner. It is an agent-mode triage tool for agentic coding.

## What to avoid saying

- Do not imply LoopPilot automatically fixes GitHub issues.
- Do not imply it runs tasks to completion.
- Do not imply it commits, pushes, deploys, publishes, or installs new dependencies.
- Do not call it mature infrastructure; call it an early safety protocol.

## Links to include

- README: `README.md`
- Quickstart: `docs/LoopPilot_Quickstart.md`
- License: `LICENSE`
