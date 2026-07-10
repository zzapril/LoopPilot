# LoopPilot 0.4.0 Release Candidate

Status: release candidate prepared locally. `@looppilot/cli@0.4.0` is not published; the latest published npm version remains `0.3.0`.

## What changes

- Surface recommendations are now enforceable contracts. Every host declares `host_capabilities.supported_surfaces`, and every contract has a matching `surface_config` for `goal`, `loop`, or `routine`.
- Unsupported execution surfaces fall back to planning. External `loop` and `routine` sources are read-only, cannot mutate external state, and require `external_access` in both confirmation layers.
- Frozen or locked dependency setup uses `install_locked_dependencies` and requires explicit `dependency_setup` confirmation.
- Dependency graph changes are represented separately by the forbidden action `mutate_dependencies`.
- Installation preflights every destination before writing, rejects symlink path escapes, uses same-directory atomic replacement, and removes newly created files/directories during rollback.
- Repository scan results distinguish `ok`, `unavailable`, and `failed`; git status parsing is NUL-safe, nested risk paths are discovered, and traversal is bounded.
- GitHub issue intake rejects ambiguous or unsafe issue-number URL forms.
- Runtime JSON Schema validation uses a generated standalone validator with an exact schema fingerprint and drift check, so package execution does not depend on Ajv at runtime or silently validate against a different schema.
- Command gates require a non-empty command; non-command gates require `command: null`.
- `doctor` detects stale or modified Agent Pack files and returns a direct force-refresh hint.
- Wrapper parity validates every golden output against the complete schema and safety model, including confirmation and report fields.
- Decision-state fields are mutually consistent: clarification, plan, no-go, and executable outputs cannot carry contradictory payloads, whitespace-only evidence, or omit `gate_passes`.
- Scan detects risk-keyword filenames such as `auth.ts` and sensitive package/client configuration such as `.npmrc`, while git probes have a fixed timeout.
- CLI duplicate options fail instead of silently using the last value.
- Issue intake accepts only canonical HTTPS GitHub URLs without credentials/non-standard ports and escapes untrusted inline Markdown metadata.
- Parity validation rejects unsupported modes, duplicate fixture IDs, and extra golden records that have no fixture.
- Command gates reject compound shell syntax, destructive/mutating commands, dependency setup, git publication, downloads, release scripts, and external-state tools.
- `NO_GO` outputs cannot request clarification, which prevents an unsafe task from appearing conditionally executable.
- Export, save, doctor-report, and issue-intake output paths reject project symlink escapes and protected Agent Pack destinations; replacements are atomic and issue output paths are checked before network access.
- In-project names beginning with `..` no longer bypass containment checks, and Agent Pack protection is case-insensitive for macOS/Windows filesystems.
- Dependency manifests/lockfiles and sensitive files are protected output destinations; save commands cannot copy sensitive source paths.
- Sensitive paths are forbidden in command gates, including absolute `.env` paths and credential/client configuration.
- Cross-platform replacement preserves a displaced original instead of deleting it if both replacement and restoration fail.
- Supported Node.js versions are `>=22`; CI covers Node 22, 24, and 26.

## Migration from 0.3.0

Decision and contract producers must make these direct replacements:

- `forbidden_actions: ["install_dependencies"]` becomes `forbidden_actions: ["mutate_dependencies"]`.
- `human_confirmations: ["dependency_install"]` becomes `human_confirmations: ["dependency_setup"]` only when `install_locked_dependencies` is allowed; otherwise remove the obsolete confirmation.
- Add `host_capabilities.supported_surfaces` to every decision.
- Add `contract.surface_config` to every executable contract, matching `recommended_surface`.
- Use `read_external_state` or `read_external_source` for read-only external `loop`/`routine` input, keep `mutate_external_state` forbidden, and add `external_access` to both `required_user_confirmation` and `human_confirmations`.

These enum changes intentionally have no backward-compatibility alias. Existing `0.3.0` JSON must be regenerated or migrated before validating against schema v2.

## Release boundary

No npm publish, git push, deployment, or release creation is part of this candidate preparation. Complete `docs/release-checklist.md`, obtain explicit release approval, then publish and record the registry timestamp and shasum.
