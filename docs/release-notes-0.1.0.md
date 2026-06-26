# LoopPilot 0.1.0 Release Notes

Status: release-ready for local review. This version has not been published to npm.

## Highlights

- Provides a shared LoopPilot core for Codex and Claude Code with thin wrappers and a Claude `/should-loop` command alias.
- Includes validated decision fixtures, runtime JSON Schema compatibility checks, wrapper parity checks, scan safety checks, export checks, save command checks, install/doctor integration, and package content validation.
- Supports explicit handoff exports for Codex, Claude Code, and GitHub issue workflows.
- Supports explicit save commands for latest contract/report/review-gate files and v1 manual artifacts.
- Aligns v1 reusable artifact defaults with documented uppercase files: `.looppilot/VISION.md`, `.looppilot/STATE.md`, and `.looppilot/RUN_LOG.md`.

## Validation

Release review should confirm these commands pass before publishing:

```bash
npm test
npm run eval:wrapper-parity
node scripts/looppilot.mjs doctor --target both --json
env npm_config_cache=/private/tmp/looppilot-npm-cache npm pack --dry-run
git diff --check
```

## Publish Hold

`npm publish` is intentionally not part of the automated validation flow. Publish only after a human reviews package contents and explicitly approves release.
