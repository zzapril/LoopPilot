# LoopPilot

LoopPilot is an agent-native loop qualification pack for Codex and Claude Code. It decides whether a task should run as a bounded loop, emits schema-valid JSON, renders a contract, and lets the current agent execute only when safe.

## Install In A Project

From the LoopPilot package or repository:

```bash
npx @looppilot/cli install --target both --scope project
```

From this repository during development:

```bash
node scripts/looppilot.mjs install --target both --scope project
```

The installer copies:

```text
.looppilot/core/
.looppilot/fixtures/
.agents/skills/looppilot/SKILL.md
.claude/skills/looppilot/SKILL.md
.claude/commands/should-loop.md
```

It does not run loops, install providers, start daemons, commit, push, or deploy.

## Check Installation

```bash
node scripts/looppilot.mjs doctor --target both
```

## Validate This Repo

```bash
npm test
```

This validates the 45 decision fixtures and confirms the Codex / Claude Code wrappers reference the same shared core.
