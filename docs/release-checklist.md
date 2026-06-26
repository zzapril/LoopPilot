# Release Checklist

Use this checklist before publishing `@looppilot/cli` to npm.

## Package Readiness

- [ ] Confirm the package should be published publicly as `@looppilot/cli`.
- [ ] Confirm `package.json` has `"private": false`, `"license": "MIT"`, repository metadata, and public scoped-package publish config.
- [ ] Confirm the `files` whitelist contains only source, wrapper, core, fixture, script, README, and license files needed by users.
- [ ] Confirm no secrets, credentials, local-only files, generated handoff exports, or latest contract/report files are included.
- [ ] Confirm the README install instructions match the final package name and CLI behavior.

## Validation

- [ ] Run `npm test` and confirm it exits successfully.
- [ ] Run `npm pack --dry-run` and review the listed files.
- [ ] Confirm `.looppilot/exports/` is not present in the package contents.
- [ ] Confirm `.looppilot/latest-contract.md` and `.looppilot/latest-report.md` are not present in the package contents.
- [ ] Confirm the package tarball does not include generated exports or latest files before any publish command is run.

## Publish Hold

- [ ] Do not run `npm publish` until the package contents review has been completed and approved.
- [ ] If the dry-run package contents are unexpected, update the `files` whitelist and repeat validation.
- [ ] After approval, publish from a clean working tree and record the package version and npm URL in the release notes.
