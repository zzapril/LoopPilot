# Release Checklist

Use this checklist to audit published and release-ready `@looppilot/cli` versions.

Current status: `0.2.0` is the latest release line. `0.1.0` was published to npm on `2026-06-27T13:41:56.460Z`.

- npm URL: https://www.npmjs.com/package/@looppilot/cli
- Dist tag: `latest`
- Shasum: `611c591fa361bf9a1bb4209fd028b8e842eb017a`

Current repository status: `0.2.0` is publish-approved code for agent-native GitHub issue URL intake.

## Package Readiness

- [x] Confirm the package should be published publicly as `@looppilot/cli`.
- [x] Confirm `package.json` has `"private": false`, `"license": "MIT"`, repository metadata, and public scoped-package publish config.
- [x] Confirm `package.json` version is `0.2.0`.
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

## 0.1.0 Publish Record

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

- [x] Rerun the full validation section and confirm the package tarball includes `.looppilot/scripts/issue-intake.mjs`, wrapper updates, docs, and `scripts/validate-issue-intake.mjs`.
- [ ] Publish `@looppilot/cli@0.2.0` to npm.
- [ ] Record the published timestamp and shasum after npm publish succeeds.
- [ ] Verify `npm view @looppilot/cli version` returns `0.2.0`.
- [ ] Verify `npx @looppilot/cli@0.2.0 --help` runs from a clean temporary directory.
- [ ] Verify published-package install and doctor pass from a clean temporary directory.
