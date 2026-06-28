# LoopPilot 0.2.1 Release Notes

Status: release candidate; do not publish without separate approval.

- Package: `@looppilot/cli@0.2.1`
- Latest published npm version remains `@looppilot/cli@0.2.0` until this version is published.
- npm URL: https://www.npmjs.com/package/@looppilot/cli

## Highlights

- Simplifies the primary user path to one install command plus one agent prompt:
  - `npx @looppilot/cli@0.2.1 install`
  - Claude Code: `/should-loop <task-or-issue-url>`
  - Codex: `Use LoopPilot on <task-or-issue-url>`
- Keeps `install` defaulting to both Codex and Claude Code project wrappers.
- Makes `looppilot --help` beginner-friendly and moves full helper/debug commands to `looppilot help advanced`.
- Adds install output that tells users the next Claude Code, Codex, and doctor commands.
- Does not add `context-summary`, comments expansion, linked PR intake, a runner, queue, scheduler, provider registry, or GitHub write behavior.

## Validation

Release-ready review must confirm these commands pass before publishing:

```bash
npm test
npm run eval:wrapper-parity
node scripts/looppilot.mjs doctor --target both --json
env npm_config_cache=/private/tmp/looppilot-npm-cache npm pack --dry-run
git diff --check
```

Publish verification records should be added to `docs/release-checklist.md` only after npm publish succeeds.
