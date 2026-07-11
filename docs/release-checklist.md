# Release Checklist

Use this checklist to audit published and release-ready `@looppilot/cli` versions.

Current status: `0.4.1` is the latest published release line. `0.4.1` was published to npm on `2026-07-11T04:30:54.462Z`.

- npm URL: https://www.npmjs.com/package/@looppilot/cli
- Dist tag: `latest`
- Shasum: `9e81bf7c9e1ffed27c2b4c0d4d8f448d6001f78d`

Current repository status: `0.4.1` is published. It adds verifier-only gates, shared file-safety helpers, package/runtime separation, and token-free release automation.

## Package Readiness

- [x] Confirm the package should be published publicly as `@looppilot/cli`.
- [x] Confirm `package.json` has `"private": false`, `"license": "MIT"`, repository metadata, and public scoped-package publish config.
- [x] Confirm `package.json` version is `0.4.1`.
- [x] Confirm the `files` whitelist contains only source, wrapper, core, fixture, script, docs, README, and license files needed by users.
- [x] Confirm no secrets, credentials, local-only files, generated handoff exports, latest files, or generated v1 artifacts are intended for the package.
- [x] Confirm the README install instructions match the package name and CLI behavior.
- [x] Confirm `.looppilot/scripts/issue-intake.mjs` is included so installed agent wrappers can call the helper locally.

## Validation

- [x] Run `npm test` and confirm it exits successfully.
- [x] Confirm schema validation includes safety negative probes for invalid `RUN_WITH_CONTRACT` host capabilities.
- [x] Confirm `npm test` includes packed CLI runtime smoke checks for help, doctor, install dry-run, command-specific unsupported/no-op argument rejection, and local tarball bin install.
- [x] Run `npm run eval:wrapper-parity` and confirm golden wrapper output parity passes.
- [x] Run `node scripts/looppilot.mjs doctor --target both --json` and confirm metadata includes core files, installed file counts, and hashes.
- [x] Run `env npm_config_cache=/private/tmp/looppilot-npm-cache npm pack --dry-run` and review the listed files.
- [x] Confirm `.looppilot/exports/` is not present in the package contents.
- [x] Confirm `.looppilot/latest-contract.md`, `.looppilot/latest-report.md`, and `.looppilot/latest-review-gate.md` are not present in the package contents.
- [x] Confirm generated `.looppilot/VISION.md`, `.looppilot/STATE.md`, and `.looppilot/RUN_LOG.md` are not present in the package contents.
- [x] Confirm uppercase v1 templates and helper scripts are present in the package contents.
- [x] Confirm release docs are present so README links and docs consistency validation remain self-contained.
- [x] Confirm GitHub issue intake tests cover mock API success, auth headers, PR rejection, readable HTTP errors, redaction, truncation, incomplete-context warnings, output modes, and no heavy endpoint calls.
- [x] Run `git diff --check` and confirm no whitespace errors.
- [x] Confirm GitHub Actions CI mirrors the local release gate for tests, wrapper parity, doctor, package dry-run, and whitespace checks.

## npm Publish Playbook

Prefer `.github/workflows/publish.yml`, npm trusted publishing, and the protected `npm-publish` environment. Configure npm with repository `zzapril/LoopPilot`, workflow filename `publish.yml`, environment `npm-publish`, and permission for `npm publish`. The workflow uses OIDC, verifies that the tag equals `v<package version>`, and rejects tagged commits that are not reachable from `main`.

The token flow below is an emergency fallback only. It records the `0.2.0` publishing lessons without storing any real token.

Before publishing:

- Use the temporary npm cache for every npm command in this repo, because the local default cache previously hit an `ELOOP` symlink-loop error.
- Confirm the version is new. npm versions are immutable; after `0.2.0` is published, new functionality must use `0.2.1`, `0.3.0`, or another new version.
- Run the release validation commands before `npm publish`.
- Confirm `npm whoami` returns the expected maintainer account with the temporary cache.

```bash
env npm_config_cache=/private/tmp/looppilot-npm-cache npm whoami
npm test
npm run eval:wrapper-parity
node scripts/looppilot.mjs doctor --target both --json
env npm_config_cache=/private/tmp/looppilot-npm-cache npm pack --dry-run
git diff --check
```

Authentication notes:

- npm browser login and Security Key/WebAuthn can authenticate the account, but `npm publish` may still fail with `EOTP` if the CLI needs a six-digit authenticator code.
- If using an npm granular access token, scope it narrowly to `@looppilot/cli`, grant package `Read and write`, set organization permission to `No access`, use a short expiration, and enable `Bypass two-factor authentication (2FA)` only for the release token.
- Never paste npm tokens into chat, docs, shell history, git commits, logs, or artifacts. If a token is exposed, revoke/delete it immediately in npm Access Tokens after publishing or before retrying.

Safe token-based publish flow:

```bash
cd /Users/zhangzheng/Documents/LoopPilot

printf 'Paste npm token, then press Enter: ' >/dev/tty
IFS= read -rs NPM_TOKEN
printf '\n' >/dev/tty

TMP_NPMRC=/tmp/looppilot-npmrc
printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$TMP_NPMRC"

env npm_config_userconfig="$TMP_NPMRC" \
  npm_config_cache=/private/tmp/looppilot-npm-cache \
  npm publish --access public

rm -f "$TMP_NPMRC"
unset NPM_TOKEN
```

Post-publish verification:

```bash
env npm_config_cache=/private/tmp/looppilot-npm-cache \
  npm view @looppilot/cli version dist.shasum time --json

TMPDIR=$(mktemp -d /private/tmp/looppilot-smoke-XXXXXX)
cd "$TMPDIR"
env npm_config_cache=/private/tmp/looppilot-npm-cache npx @looppilot/cli@<version> --help
env npm_config_cache=/private/tmp/looppilot-npm-cache npx @looppilot/cli@<version> install --target both --cwd "$TMPDIR"
env npm_config_cache=/private/tmp/looppilot-npm-cache npx @looppilot/cli@<version> doctor --target both --cwd "$TMPDIR" --json
```

After verification:

- Record the publish timestamp and shasum in this checklist.
- Update the matching release notes.
- Revoke/delete any temporary or exposed npm publish token.
- Commit the release record.
- Push to GitHub separately; npm publish success does not imply git push success.

## 0.1.0 Publish Record

- Published: `2026-06-27T13:41:56.460Z`
- Shasum: `611c591fa361bf9a1bb4209fd028b8e842eb017a`
- [x] Do not run `npm publish` until the package contents review has been completed and approved.
- [x] After push, confirm the GitHub Actions CI run passes on `main`.
- [x] Authenticate to npm with publish access for `@looppilot/cli`.
- [x] Confirm the dry-run package contents are expected.
- [x] Publish from a clean working tree.
- [x] Record the package version and npm URL in the release notes.
- [x] Verify `npm view @looppilot/cli version` returns `0.1.0`.
- [x] Verify `npx @looppilot/cli@0.1.0 --help` runs from a clean temporary directory.
- [x] Verify published-package Claude install and doctor pass from a clean temporary directory.
- [x] Smoke-test Claude Code `/should-loop` against the published package without editing files, running commands, or saving artifacts.

## 0.2.0 Publish Record

- Published: `2026-06-28T14:51:47.490Z`
- Shasum: `06bce22ba875bf5f63298e26aa8386702fcca9f6`
- [x] Rerun the full validation section and confirm the package tarball includes `.looppilot/scripts/issue-intake.mjs`, wrapper updates, docs, and `scripts/validate-issue-intake.mjs`.
- [x] Publish `@looppilot/cli@0.2.0` to npm.
- [x] Record the published timestamp and shasum after npm publish succeeds.
- [x] Verify `npm view @looppilot/cli version` returns `0.2.0`.
- [x] Verify `npx @looppilot/cli@0.2.0 --help` runs from a clean temporary directory.
- [x] Verify published-package install and doctor pass from a clean temporary directory.

## 0.2.1 Publish Record

- Published: `2026-06-28T16:14:10.092Z`
- Shasum: `a7f100660d0174036ceac82a93f2f1b64e0ac28e`
- Focus: simplify primary UX to `looppilot install`, `looppilot doctor`, `/should-loop <task-or-issue-url>`, and `Use LoopPilot on <task-or-issue-url>`.
- [x] Rerun the full validation section after UX simplification changes.
- [x] Confirm default `looppilot --help` is beginner-friendly and `looppilot help advanced` contains full helper/debug commands.
- [x] Verify local packed tarball install and doctor pass from a clean temporary directory.
- [x] Publish `@looppilot/cli@0.2.1` to npm.
- [x] Record the published timestamp and shasum after npm publish succeeds.
- [x] Confirm `npx @looppilot/cli@0.2.1 --help`, `install`, and `doctor --json` work from a clean temporary directory.

## 0.2.2 Publish Record

- Published: `2026-06-28T16:26:38.021Z`
- Shasum: `f9559a1cfa9f05e08e1ec042db9006154a759e74`
- Status: documentation hotfix published for npm package README/Quickstart install accuracy.
- Focus: make the npm package page point directly to `npx @looppilot/cli@0.2.2 install`.
- [x] Publish `@looppilot/cli@0.2.2` to npm.
- [x] Record the published timestamp and shasum after npm publish succeeds.
- [x] Confirm `npx @looppilot/cli@0.2.2 --help`, `install`, and `doctor --json` work from a clean temporary directory.

## 0.2.3 Publish Record

- Published: `2026-06-29T15:36:05.503Z`
- Shasum: `41eb28ba38bdb515f3be7661657851c4b035fbee`
- Focus: publish the frozen dependency setup guardrails and refreshed README/launch positioning.
- [x] Rerun the full validation section after the dependency policy and README updates.
- [x] Confirm package docs point to `npx @looppilot/cli@0.2.3 install`.
- [x] Publish `@looppilot/cli@0.2.3` to npm.
- [x] Record the published timestamp and shasum after npm publish succeeds.
- [x] Confirm `npx @looppilot/cli@0.2.3 --help`, `install`, and `doctor --json` work from a clean temporary directory.

## 0.2.4 Publish Record

- Published: `2026-06-30T15:15:57.875Z`
- Shasum: `9251f12b7e4179fb546ea0336cc9c99cde044398`
- Focus: prevent issue-intake from sending GitHub tokens to custom API base URLs.
- [x] Rerun the full validation section after the issue-intake token handling fix.
- [x] Confirm custom issue-intake API base URLs do not receive `GITHUB_TOKEN` or `GH_TOKEN`.
- [x] Publish `@looppilot/cli@0.2.4` to npm.
- [x] Record the published timestamp and shasum after npm publish succeeds.
- [x] Confirm `npx @looppilot/cli@0.2.4 --help`, `install`, and `doctor --json` work from a clean temporary directory.

## 0.3.0 Publish Record

- Published: `2026-07-09T15:52:06.162Z`
- Shasum: `6574c30221bec3141779f40508d1981b05388868`
- Focus: add Claude Code `/loop`-aware recommendations without adding a runner, scheduler, GitHub queue, background workflow, or automatic resume.
- [x] Rerun the full validation section after the `recommended_surface` schema, wrapper, docs, and fixture updates.
- [x] Confirm fixtures include `recommended_surface` coverage for `manual`, `plan`, `goal`, `loop`, and `routine`.
- [x] Confirm README and Quickstart explain that LoopPilot does not replace Claude Code `/loop`; it helps decide when `/loop` is the right surface.
- [x] Publish `@looppilot/cli@0.3.0` to npm only after release validation passes and publish credentials are available.
- [x] Record the published timestamp and shasum after npm publish succeeds.
- [x] Confirm `npx @looppilot/cli@0.3.0 --help`, `install`, and `doctor --json` work from a clean temporary directory.

## 0.4.0 Publish Record

- Published: `2026-07-10T15:14:46.851Z`
- Shasum: `9b3ebfd33f2b80017c2d6c5c71cd597282414c14`
- Status: published to npm with the `latest` dist tag; registry verification and clean-directory package smoke tests passed.
- Focus: make surface recommendations enforceable and close the installer, scan, intake, dependency, schema-runtime, and Node support gaps found in the post-`0.3.0` review.
- [x] Require `host_capabilities.supported_surfaces` and a matching `surface_config` for executable contracts.
- [x] Keep external `loop` and `routine` sources read-only and capability-gated.
- [x] Replace `install_dependencies` with `mutate_dependencies`, and replace `dependency_install` with `dependency_setup`.
- [x] Require explicit `dependency_setup` confirmation for frozen/locked dependency setup.
- [x] Preflight every install destination before writing and roll back atomically on failure.
- [x] Distinguish unavailable and failed scan commands, parse NUL-delimited git status, and discover nested risk paths with a traversal bound.
- [x] Reject malformed, zero, leading-zero, unsafe-integer, and extra-segment GitHub issue URLs.
- [x] Generate and drift-check a standalone runtime schema validator.
- [x] Reject Agent Pack install paths containing symlink components and verify stale installed files with `doctor`.
- [x] Require non-empty command gates, exact external-access confirmations, and action-aligned dependency confirmations.
- [x] Validate complete wrapper golden outputs, including confirmation and report fields.
- [x] Enforce the scan traversal limit without inspecting an extra entry.
- [x] Enforce decision-state/clarification invariants and mandatory `gate_passes` stop conditions.
- [x] Detect risk-keyword filenames and common sensitive client configuration without reading contents.
- [x] Reject duplicate CLI options and non-canonical GitHub issue URLs.
- [x] Escape untrusted issue metadata in Markdown and reject parity dataset extras/mode typos.
- [x] Reject unsafe command gates and contradictory NO_GO clarification state.
- [x] Protect every explicit output command from project symlink escapes and Agent Pack overwrites.
- [x] Use atomic replacement for export/save/doctor/issue outputs and validate issue destinations before network access.
- [x] Cover `..name` containment, case-insensitive protected paths, and failed-replacement original preservation.
- [x] Protect dependency manifests/lockfiles and sensitive output/source paths across explicit file commands.
- [x] Reject sensitive file references in command gates, including absolute and option-assignment forms.
- [x] Set Node support to `>=22` and CI coverage to Node 22, 24, and 26.
- [x] Run the complete local release validation section on the final candidate.
- [x] Publish `@looppilot/cli@0.4.0` only after explicit release approval and credentials are available.
- [x] Record npm timestamp and shasum, then run published `npx` install/doctor smoke tests.
- [x] Fast-forward the release commit into `main` and confirm GitHub Actions run `29138991988` succeeds.

## 0.4.1 Publish Record

- Published: `2026-07-11T04:30:54.462Z`
- Shasum: `9e81bf7c9e1ffed27c2b4c0d4d8f448d6001f78d`
- Status: published to npm with the `latest` dist tag; main CI, registry verification, and clean-directory package smoke tests passed.
- Focus: close arbitrary gate-command execution, remove duplicated file-safety logic, separate runtime from test code, reduce package contents, and move publishing to OIDC.
- [x] Fast-forward published `0.4.0` into remote and local `main` without overwriting preserved local changes.
- [x] Replace the gate-command denylist with a local verifier allowlist.
- [x] Reject package executors, arbitrary scripts, containers, cloud CLIs, and external-state commands as gates.
- [x] Share path and atomic-write safety logic between CLI and issue intake.
- [x] Separate runtime wrapper parity validation from eval mutation probes.
- [x] Restrict npm package contents to runtime scripts and generated runtime validation.
- [x] Pin CI actions, add CI timeouts, and add an OIDC publish workflow with tag/version/main validation.
- [x] Run the complete release validation suite and inspect the final package.
- [ ] Configure npm trusted publishing for future token-free releases.
- [x] Merge to `main`, confirm CI, publish `@looppilot/cli@0.4.1`, and verify the package.
- [x] Record npm timestamp `2026-07-11T04:30:54.462Z` and shasum `9e81bf7c9e1ffed27c2b4c0d4d8f448d6001f78d`.
