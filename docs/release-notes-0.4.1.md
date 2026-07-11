# LoopPilot 0.4.1 Release Notes

Published: `2026-07-11T04:30:54.462Z`

- Package: `@looppilot/cli@0.4.1`
- Dist tag: `latest`
- Shasum: `9e81bf7c9e1ffed27c2b4c0d4d8f448d6001f78d`

## What changes

- Command gates now use a verifier allowlist instead of treating unknown executables as safe.
- Arbitrary Node/Python/shell scripts, package executors, containers, cloud CLIs, and external-state tools are rejected as gates.
- File containment, protected-path, sensitive-path, dependency metadata, and atomic replacement logic now live in `.looppilot/scripts/file-safety.mjs`, shared by the CLI and issue intake.
- Wrapper parity runtime logic is separated from mutation probes and eval-only code.
- The npm package excludes development-only validation, eval, reporting, and generator entry points.
- CI jobs have explicit time limits and use GitHub Actions pinned to immutable commit SHAs.
- A tag-triggered npm trusted-publishing workflow validates tag/package version equality and requires the tagged commit to be reachable from `main`.
- Tag workflows detect an already-published immutable npm version and skip duplicate upload attempts after an approved manual fallback publish.

## Verification

- Main CI passed for the release source commit.
- The published package passed `npx` help, project install for both agent targets, and `doctor --json` from a clean temporary directory.
- Doctor reported package version `0.4.1`, 20 installed files, and complete pack integrity.
- The published tarball contains 51 files, is about 113 kB compressed, and has no development-only validation entry points.
- Future releases can use npm trusted publishing through `.github/workflows/publish.yml` after the registry trust relationship is configured.
