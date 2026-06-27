# Release Checklist

Use this checklist before publishing `@looppilot/cli` to npm.

Current status: `0.1.0` is prepared for local release review. `npm publish` has not been run and still requires explicit human approval.

## Package Readiness

- [ ] Confirm the package should be published publicly as `@looppilot/cli`.
- [x] Confirm `package.json` has `"private": false`, `"license": "MIT"`, repository metadata, and public scoped-package publish config.
- [x] Confirm `package.json` version is `0.1.0`.
- [x] Confirm the `files` whitelist contains only source, wrapper, core, fixture, script, docs, README, and license files needed by users.
- [x] Confirm no secrets, credentials, local-only files, generated handoff exports, latest files, or generated v1 artifacts are intended for the package.
- [x] Confirm the README install instructions match the package name and CLI behavior.

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
- [x] Run `git diff --check` and confirm no whitespace errors.
- [x] Confirm GitHub Actions CI mirrors the local release gate for tests, wrapper parity, doctor, package dry-run, and whitespace checks.

## Publish Hold

- [x] Do not run `npm publish` until the package contents review has been completed and approved.
- [ ] After push, confirm the GitHub Actions CI run passes on `main`.
- [ ] If the dry-run package contents are unexpected, update the `files` whitelist and repeat validation.
- [ ] After approval, publish from a clean working tree and record the package version and npm URL in the release notes.
