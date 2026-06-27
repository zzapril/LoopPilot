# LoopPilot Orchestration v2

**Date**: 2026-06-26  
**Status**: single GitHub issue intake implemented; other orchestration remains planning only
**Depends on**: stable v1 artifacts and verifier gates

---

## 1. Purpose

This document defines the safety envelope for LoopPilot v2 orchestration surfaces. It authorizes only the narrow single GitHub issue intake shipped in `0.2.0`; all other orchestration remains planning material.

LoopPilot v2 orchestration is currently limited to lightweight single issue intake. Any future orchestration surface must preserve the MVP principle that LoopPilot is a loop qualification and contract layer, not a replacement agent runtime.

---

## 2. Explicit non-goals inherited from MVP

The following MVP non-goals remain binding for v2 unless a later approved design explicitly changes them:

1. **No default runner**
   - LoopPilot must not ship a default autonomous runner that executes tasks outside the current approved host/session by default.
   - Any future orchestration surface must hand work to an explicitly selected host or human-approved execution path.

2. **No automatic push or deploy**
   - LoopPilot must not automatically push branches, merge pull requests, publish packages, deploy services, or mutate production systems.
   - Push/deploy/publish actions require separate explicit human action outside the default orchestration path.

3. **No provider registry by default**
   - LoopPilot must not include a default registry of model or agent providers.
   - Provider selection, credentials, and execution backends must remain host-owned or user-provided until an approved post-v1 design defines otherwise.

4. **No broad orchestration before approval**
   - The only implemented v2 surface is single issue intake.
   - Do not add queues, schedulers, runners, hooks, provider registries, or GitHub write automation without a later approved design.

---

## 3. Shared orchestration rules

All v2 orchestration surfaces must follow these shared rules:

- **Agent-first**: issue intake may prepare read-only context, but Codex or Claude Code must still make the LoopPilot decision in the current session.
- **Contract-first**: no executable work may start unless it has a LoopPilot decision and, when executable, a bounded loop contract.
- **Human-visible state**: issue intake and any future permissioned action must have a human-readable summary before execution.
- **Least authority**: orchestration must request the narrowest file, command, network, token, and permission scope that can satisfy the contract.
- **No silent escalation**: a task may not move from read-only to write, from sandboxed to unsandboxed, from local to remote, or from draft to deploy without fresh confirmation.
- **Deterministic stop behavior**: each orchestration path must define objective stop conditions before work begins.
- **Auditable by default**: each path must produce an audit artifact that explains what was accepted, skipped, blocked, run, and stopped.

---

## 4. Single GitHub issue intake

Single GitHub issue intake is the approved v2 intake surface. A user explicitly gives one issue URL to Codex or Claude Code, and LoopPilot reads a narrow issue packet for that same agent session. It is not a GitHub issue queue or bot.

### 4.1 Safety requirements

- Intake must treat every issue body as untrusted user input.
- Intake must not execute issue text as shell commands, config, workflow definitions, or agent instructions.
- Intake may read only title, body, labels, state, author, timestamps, URL, and comments count from `GET /repos/{owner}/{repo}/issues/{issue_number}`.
- Intake must not read comments, linked pull requests, attachments, logs, timeline events, or issue lists in the first version.
- Intake must not classify the issue itself. The current Codex or Claude Code session must classify as `NO_GO`, `PLAN_ONLY`, or `RUN_WITH_CONTRACT` using the shared core rules.
- Intake must mark the packet as `possibly_incomplete` when comments exist, the URL references a comment anchor, the body is truncated, or issue title/body text references omitted context.
- Intake must reject pull-request URLs or issue API responses that contain `pull_request`.
- Intake must not create commits, branches, pull requests, labels, assignments, comments, or issue state changes.

### 4.2 Required user confirmation

A human maintainer must confirm before:

- reading omitted context such as comments, linked PRs, attachments, logs, or timeline events;
- continuing execution from a `possibly_incomplete` packet without reading omitted context;
- allowing any repository write action, including branch creation, commits, issue comments, status updates, or pull request drafts;
- expanding the contract beyond the original issue scope.

### 4.3 Audit output

Each issue intake packet must contain:

- repository and issue identifiers;
- issue title, state, labels, author, timestamps, URL, and comments count;
- redacted issue body;
- read mode;
- context completeness status and warnings;
- the list of intentionally omitted context types;
- a handoff prompt for Codex or Claude Code.

### 4.4 Stop conditions

Issue intake must stop when:

- the input is not a GitHub issue URL or `owner/repo` plus issue number;
- the referenced object is a pull request;
- the issue cannot be read because of auth, permission, existence, or rate-limit errors;
- the response is not valid JSON;
- a requested output file already exists and `--force` was not provided;
- intake would require comments, linked PRs, attachments, logs, timeline, issue list scanning, or GitHub writes.

### 4.5 Explicit non-goals for issue intake

- No automatic issue scanning.
- No queue selection by label, milestone, assignee, project, or search query.
- No automatic code execution from issue text.
- No automatic PR creation, comments, issue closing, labels, assignment, commit, push, deploy, or release.

---

## 5. Deferred surfaces not authorized in 0.2.0

The following surfaces are intentionally not part of the release-ready v2 implementation:

- scheduled loops or reminders;
- sandbox or approval probing beyond existing host assumptions;
- Claude permission hooks;
- webhooks, issue labels, CI signals, or other asynchronous triggers;
- any `looppilot run` command;
- automatic branch creation, commits, PRs, pushes, deploys, comments, or issue state changes.

If one of these surfaces is reconsidered later, it needs a separate approved design, fixtures, validators, and user-facing docs before implementation. It must not be smuggled in through issue intake.

---

## 6. Gates before any additional v2 implementation

Single GitHub issue intake is the only approved v2 implementation in `0.2.0`. No additional v2 implementation code should be added until the following artifacts and verifier gates are stable:

- qualification rules are stable and versioned;
- decision schema has compatibility tests and drift checks;
- contract template has verifier coverage;
- fixtures cover high-risk and orchestration-adjacent cases;
- wrapper parity checks pass for supported hosts;
- scan, issue-intake, export, save, and report behavior is documented and tested;
- audit-output requirements are represented in fixtures or verifier tests;
- stop-condition behavior is tested for all executable decisions;
- documentation clearly distinguishes LoopPilot qualification from execution hosts.

Until those gates are stable, additional v2 work is limited to:

- documentation;
- threat models;
- taxonomy and fixture design;
- verifier requirements;
- review checklists;
- non-executable examples.
