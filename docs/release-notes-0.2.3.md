# LoopPilot 0.2.3 Release Notes

Status: published to npm.

- Package: `@looppilot/cli@0.2.3`
- Latest published npm version after this release: `@looppilot/cli@0.2.3`
- npm URL: https://www.npmjs.com/package/@looppilot/cli

## Highlights

- Publishes the frozen dependency setup policy across LoopPilot wrappers, contracts, export handoffs, docs, and CLI/help text.
- Keeps dependency mutation out of bounded loops: no new dependency installs, package-specific installs, dependency updates, `package.json` edits, or lockfile edits.
- Allows only existing-lockfile setup commands: `pnpm install --frozen-lockfile`, `npm ci`, or `bun install --frozen-lockfile`.
- Recommended install path: `npm install -g @looppilot/cli`, then `looppilot install` and `looppilot doctor`.
- One-off trial command: `npx @looppilot/cli@0.2.3 install`. If `npx` keeps spinning, use the global install path.
- Refreshes the README around the loop-decision/stopping-boundary story, adds the demo output asset, and includes short launch notes.
- Keeps the core UX unchanged:
  - `looppilot install`
  - `looppilot doctor`
  - Claude Code: `/should-loop <task-or-issue-url>`
  - Codex: `Use LoopPilot on <task-or-issue-url>`
- Does not add a runner, provider registry, GitHub issue queue, scheduler, automatic resume, automatic commit/push/deploy/publish, or GitHub write workflow.

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
