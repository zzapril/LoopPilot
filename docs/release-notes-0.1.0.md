# LoopPilot 0.1.0 Release Notes

Status: published to npm.

- Package: `@looppilot/cli@0.1.0`
- npm URL: https://www.npmjs.com/package/@looppilot/cli
- Published at: `2026-06-27T13:41:56.460Z`
- Dist tag: `latest`
- Shasum: `611c591fa361bf9a1bb4209fd028b8e842eb017a`

## Highlights

- Provides a shared LoopPilot core for Codex and Claude Code with thin wrappers and a Claude `/should-loop` command alias.
- Includes validated decision fixtures, runtime JSON Schema compatibility checks, wrapper parity checks, scan safety checks, export checks, save command checks, install/doctor integration, and package content validation.
- Supports explicit handoff exports for Codex, Claude Code, and GitHub issue workflows.
- Supports explicit save commands for latest contract/report/review-gate files and v1 manual artifacts.
- Aligns v1 reusable artifact defaults with documented uppercase files: `.looppilot/VISION.md`, `.looppilot/STATE.md`, and `.looppilot/RUN_LOG.md`.

## Validation

Release review confirmed these commands passed before publishing:

```bash
npm test
npm run eval:wrapper-parity
node scripts/looppilot.mjs doctor --target both --json
env npm_config_cache=/private/tmp/looppilot-npm-cache npm pack --dry-run
git diff --check
```

Post-publish verification also confirmed:

```bash
npm view @looppilot/cli version
npx @looppilot/cli@0.1.0 --help
npx @looppilot/cli@0.1.0 install --target claude --scope project
npx @looppilot/cli@0.1.0 doctor --target claude --json
```

Claude Code `2.1.168` was smoke-tested against the published package in a temporary project. The `/should-loop` command alias produced a LoopPilot decision and contract without editing files, running commands, or saving artifacts.
