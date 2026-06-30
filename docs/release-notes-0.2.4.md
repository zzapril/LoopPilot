# LoopPilot 0.2.4 Release Notes

Status: published to npm.

- Package: `@looppilot/cli@0.2.4`
- Latest published npm version after this release: `@looppilot/cli@0.2.4`
- npm URL: https://www.npmjs.com/package/@looppilot/cli

## Highlights

- Fixes issue-intake token handling for `LOOPPILOT_GITHUB_API_BASE_URL`.
- GitHub tokens from `GITHUB_TOKEN` or `GH_TOKEN` are sent only to the official `https://api.github.com` API.
- custom API base URLs do not receive GitHub authorization headers.
- Non-loopback custom API base URLs are rejected; loopback HTTP/HTTPS base URLs remain available for local tests.
- Recommended install path: `npm install -g @looppilot/cli`, then `looppilot install` and `looppilot doctor`.
- One-off trial command: `npx @looppilot/cli@0.2.4 install`. If `npx` keeps spinning, use the global install path.
- Keeps the core UX unchanged:
  - `looppilot install`
  - `looppilot doctor`
  - Claude Code: `/should-loop <task-or-issue-url>`
  - Codex: `Use LoopPilot on <task-or-issue-url>`

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
