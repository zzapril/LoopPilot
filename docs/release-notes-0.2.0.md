# LoopPilot 0.2.0 Release Notes

Status: release-ready in this repository; not published to npm in this change.

- Package: `@looppilot/cli@0.2.0`
- Latest published npm version remains: `@looppilot/cli@0.1.0`
- npm URL: https://www.npmjs.com/package/@looppilot/cli

## Highlights

- Adds agent-native GitHub issue URL intake for Claude Code and Codex.
- Keeps the user-facing flow inside the current agent session: `/should-loop https://github.com/owner/repo/issues/123` or `Use LoopPilot on https://github.com/owner/repo/issues/123`.
- Adds the installed read-only helper `.looppilot/scripts/issue-intake.mjs` and the debug CLI command `looppilot issue-intake`.
- Reads only a single issue endpoint and marks packets as `possibly_incomplete` when comments, comment anchors, truncation, or issue text suggest omitted context.
- Preserves the no-runner boundary: no queue, scheduler, webhook, auto PR, auto push, auto deploy, auto close issue, or GitHub write action.

## Validation

Release-ready review must confirm these commands pass before publishing:

```bash
npm test
npm run eval:wrapper-parity
node scripts/looppilot.mjs doctor --target both --json
env npm_config_cache=/private/tmp/looppilot-npm-cache npm pack --dry-run
git diff --check
```

`npm publish` requires separate explicit approval.
