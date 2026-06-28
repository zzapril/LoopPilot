# LoopPilot 0.2.2 Release Notes

Status: published to npm.

- Package: `@looppilot/cli@0.2.2`
- Latest published npm version after this release: `@looppilot/cli@0.2.2`
- npm URL: https://www.npmjs.com/package/@looppilot/cli

## Highlights

- Documentation-only hotfix after `0.2.1`.
- Updates the package README and Quickstart so npm users see `0.2.2` as the current install version.
- Current install command: `npx @looppilot/cli@0.2.2 install`.
- Keeps the `0.2.1` UX simplification behavior unchanged:
  - `looppilot install`
  - `looppilot doctor`
  - Claude Code: `/should-loop <task-or-issue-url>`
  - Codex: `Use LoopPilot on <task-or-issue-url>`
- Does not add `context-summary`, comments expansion, linked PR intake, a runner, queue, scheduler, provider registry, or GitHub write behavior.

## Validation

Release-ready review confirmed these commands passed before publishing:

```bash
npm test
npm run eval:wrapper-parity
node scripts/looppilot.mjs doctor --target both --json
env npm_config_cache=/private/tmp/looppilot-npm-cache npm pack --dry-run
git diff --check
```

Publish verification records are maintained in `docs/release-checklist.md`.
