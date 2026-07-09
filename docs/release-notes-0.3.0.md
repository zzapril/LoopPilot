# LoopPilot 0.3.0 Release Notes

Status: published to npm.

- Package: `@looppilot/cli@0.3.0`
- Latest published npm version after this release: `@looppilot/cli@0.3.0`
- Published: `2026-07-09T15:52:06.162Z`
- Shasum: `6574c30221bec3141779f40508d1981b05388868`
- npm URL: https://www.npmjs.com/package/@looppilot/cli

## Highlights

- Adds Claude Code `/loop`-aware recommendations without implementing a runner, scheduler, queue, or background workflow.
- Adds top-level decision field `recommended_surface` with `manual`, `plan`, `goal`, `loop`, and `routine`.
- Keeps the core decision enum unchanged: `NO_GO`, `PLAN_ONLY`, and `RUN_WITH_CONTRACT`.
- Recommends `goal` for local lint, test, typecheck, and file-output gates.
- Recommends `loop` for safe tasks that wait on external state such as CI, deploy status, PR review, issue updates, or queue status.
- Recommends `routine` for recurring work only after cadence, source, permissions, report format, and stop conditions are explicit.
- Adds fixtures for CI waiting, lint goals, recurring feedback summaries, and broad quality-improvement requests.
- Recommended install path remains `npm install -g @looppilot/cli`, then `looppilot install` and `looppilot doctor`.

## Validation

Release-ready review confirmed these commands pass before publishing:

```bash
npm test
npm run eval:wrapper-parity
node scripts/looppilot.mjs doctor --target both --json
env npm_config_cache=/private/tmp/looppilot-npm-cache npm pack --dry-run
git diff --check
```

Publish verification records are maintained in `docs/release-checklist.md`.
