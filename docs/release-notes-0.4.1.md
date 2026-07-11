# LoopPilot 0.4.1 Release Candidate

Status: prepared for review. The latest published npm version remains `@looppilot/cli@0.4.0`.

## What changes

- Command gates now use a verifier allowlist instead of treating unknown executables as safe.
- Arbitrary Node/Python/shell scripts, package executors, containers, cloud CLIs, and external-state tools are rejected as gates.
- File containment, protected-path, sensitive-path, dependency metadata, and atomic replacement logic now live in `.looppilot/scripts/file-safety.mjs`, shared by the CLI and issue intake.
- Wrapper parity runtime logic is separated from mutation probes and eval-only code.
- The npm package excludes development-only validation, eval, reporting, and generator entry points.
- CI jobs have explicit time limits and use GitHub Actions pinned to immutable commit SHAs.
- A tag-triggered npm trusted-publishing workflow validates tag/package version equality and requires the tagged commit to be reachable from `main`.
- Tag workflows detect an already-published immutable npm version and skip duplicate upload attempts after an approved manual fallback publish.

## Release prerequisites

- Merge the candidate into `main` and confirm the full CI matrix passes.
- Configure npm trusted publishing for repository `zzapril/LoopPilot`, workflow `publish.yml`, environment `npm-publish`, and the `npm publish` action.
- Create `v0.4.1` only from the reviewed `main` commit. The publish workflow rejects version or ancestry mismatches.
