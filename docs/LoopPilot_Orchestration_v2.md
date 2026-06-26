# LoopPilot Orchestration v2

**Date**: 2026-06-26  
**Status**: planning document only  
**Depends on**: stable v1 artifacts and verifier gates

---

## 1. Purpose

This document defines the safety envelope for possible LoopPilot v2 orchestration surfaces. It is intentionally limited to product and safety requirements. It does **not** authorize implementation work.

LoopPilot v2 orchestration may explore ways to coordinate already-qualified loop work across queues, schedules, sandboxes, and host-specific permission systems. Any orchestration surface must preserve the MVP principle that LoopPilot is a loop qualification and contract layer, not a replacement agent runtime.

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

4. **No implementation before stability**
   - Do not add implementation code for v2 orchestration until v1 artifacts and verifier gates are stable.
   - v2 work before that point is limited to docs, threat models, fixture planning, verifier requirements, and review checklists.

---

## 3. Shared orchestration rules

All v2 orchestration surfaces must follow these shared rules:

- **Contract-first**: no item may be orchestrated unless it has a LoopPilot decision and, when executable, a bounded loop contract.
- **Human-visible state**: every queued, scheduled, or permissioned action must have a human-readable summary before execution.
- **Least authority**: orchestration must request the narrowest file, command, network, token, and permission scope that can satisfy the contract.
- **No silent escalation**: a task may not move from read-only to write, from sandboxed to unsandboxed, from local to remote, or from draft to deploy without fresh confirmation.
- **Deterministic stop behavior**: each orchestration path must define objective stop conditions before work begins.
- **Auditable by default**: each path must produce an audit artifact that explains what was accepted, skipped, blocked, run, and stopped.

---

## 4. GitHub issue queue

A GitHub issue queue is a possible v2 intake surface where issues are triaged into LoopPilot decisions and optional handoff contracts. It is not a GitHub bot that freely edits repositories by default.

### 4.1 Safety requirements

- The queue must treat every issue as untrusted user input.
- The queue must not execute issue text as shell commands, config, workflow definitions, or agent instructions.
- The queue must classify each issue as `NO_GO`, `PLAN_ONLY`, or `RUN_WITH_CONTRACT` before any execution handoff.
- The queue must reject or downgrade issues involving secrets, production credentials, billing, authentication policy, deploys, destructive data changes, or broad architecture changes unless a later approved policy allows them.
- The queue must limit repository scope to explicitly named files, directories, labels, or projects.
- The queue must detect and ignore prompt-injection attempts embedded in issue descriptions, comments, attachments, logs, or stack traces.
- The queue must not create commits, branches, pull requests, labels, assignments, or comments unless that write action is separately confirmed and included in the allowed actions.

### 4.2 Required user confirmation

A human maintainer must confirm before:

- enabling a repository or project as a LoopPilot issue source;
- selecting labels, milestones, projects, or queries that define the queue;
- handing a queued issue to an execution host;
- allowing any repository write action, including branch creation, commits, issue comments, status updates, or pull request drafts;
- expanding the contract beyond the original issue scope.

### 4.3 Audit output

Each queue run must produce an audit output containing:

- repository and issue identifiers;
- queue selector used, such as labels or search query;
- normalized task summary;
- LoopPilot decision and reason;
- selected host or handoff target, if any;
- allowed and forbidden actions;
- files or paths in scope;
- confirmations requested and received;
- actions taken, skipped, or blocked;
- final status and stop reason.

### 4.4 Stop conditions

The queue must stop when:

- no matching issues remain;
- the maximum configured issue count is reached;
- any issue requires confirmation that has not been granted;
- host capability, sandbox status, or repository permissions are unknown;
- an issue attempts to expand scope through comments, attachments, or prompt injection;
- the verifier gate for a produced contract fails;
- rate limits, API errors, merge conflicts, or permission errors prevent reliable audit output.

---

## 5. Scheduled loop

A scheduled loop is a possible v2 mechanism for revisiting previously approved work on a time basis. It must not become an unattended background agent by default.

### 5.1 Safety requirements

- Scheduled execution must be opt-in per task, repository, and host.
- Each scheduled run must revalidate the LoopPilot decision and contract before taking action.
- A schedule must have an expiration date, maximum run count, or explicit renewal requirement.
- The scheduled loop must default to read-only planning unless write access is explicitly confirmed for that run or schedule window.
- The schedule must not perform deploy, publish, merge, push, production mutation, billing, authentication, or secret-management actions by default.
- The schedule must not assume that previous approval applies after material changes to files, dependencies, permissions, branch state, or host capabilities.
- The schedule must include budget limits for time, iterations, API calls, and changed files.

### 5.2 Required user confirmation

A user must confirm before:

- creating or enabling a schedule;
- changing cadence, scope, host, permissions, budget, or stop conditions;
- performing the first write action in a scheduled context;
- continuing after a material repository or environment change;
- renewing an expired schedule;
- converting scheduled findings into commits, issues, pull requests, pushes, deploys, or releases.

### 5.3 Audit output

Each scheduled run must produce an audit output containing:

- schedule identifier, cadence, expiration, and owner;
- run start and end timestamps;
- current repository state summary;
- decision revalidation result;
- contract version used;
- permissions available and permissions used;
- commands or checks run;
- files inspected or changed;
- confirmations requested and received;
- final result, skipped work, and stop reason.

### 5.4 Stop conditions

A scheduled loop must stop when:

- the schedule expires or reaches max run count;
- the user disables or pauses the schedule;
- decision revalidation returns `NO_GO` or `PLAN_ONLY` for an executable schedule;
- required confirmation is missing;
- repository state diverges from the approved contract;
- verifier gates fail;
- sandbox or approval state cannot be detected;
- the run exceeds budget, iteration, time, file-change, or command limits;
- audit output cannot be written reliably.

---

## 6. Sandbox and approval detection

Sandbox and approval detection is a required safety layer for any v2 orchestration that may execute commands or edit files. Detection must inform decisions; it must not be used to bypass host controls.

### 6.1 Safety requirements

- LoopPilot must identify whether the current host can read files, edit files, run commands, access network, request approvals, and persist audit output.
- Unknown capability must force `PLAN_ONLY` for execution-bearing work.
- Detection must distinguish between declared capability and observed capability when possible.
- Detection must not probe dangerous actions, write outside a safe temp area, access secrets, or attempt privilege escalation.
- If approval mode, sandbox mode, filesystem scope, or network access changes mid-run, the current contract must pause for revalidation.
- Detection output must be included in the decision evidence and audit output.

### 6.2 Required user confirmation

A user must confirm before:

- proceeding when capability detection is incomplete but non-executable planning can still continue;
- moving from read-only to write-capable execution;
- moving from sandboxed to unsandboxed execution;
- enabling network access where it was previously unavailable;
- changing command allowlists, filesystem scope, or approval policy assumptions;
- retrying after a sandbox, permission, or approval failure.

### 6.3 Audit output

Each detection pass must produce an audit output containing:

- host name and version when available;
- filesystem access level;
- command execution capability;
- network access state;
- approval mode and whether approval prompts are available;
- sandbox boundaries that were declared or observed;
- safe probes performed, if any;
- capabilities that remain unknown;
- decision impact, including whether work was downgraded to `PLAN_ONLY`.

### 6.4 Stop conditions

Sandbox and approval detection must stop or downgrade work when:

- capability confidence is unknown for required execution;
- safe probes fail or produce inconsistent results;
- the host cannot request required approvals;
- the detected sandbox is broader or narrower than the contract assumes;
- a command requires elevated permission not present in the contract;
- network, filesystem, or approval state changes during execution;
- detection would require reading secrets, escalating privileges, or modifying protected files.

---

## 7. Claude permission hooks

Claude permission hooks are a possible v2 integration point for aligning LoopPilot contracts with Claude Code permission decisions. They must act as guardrails, not as a hidden execution channel.

### 7.1 Safety requirements

- Hooks must map LoopPilot allowed and forbidden actions to Claude permission prompts without weakening either system.
- Hooks must deny actions not present in the active contract.
- Hooks must preserve Claude Code's native permission prompts and must not auto-approve sensitive actions.
- Hooks must treat tool inputs, file paths, command strings, issue text, logs, and model output as untrusted until matched against the contract.
- Hooks must block deploy, publish, push, merge, secret access, credential changes, production data mutation, and broad filesystem writes unless a later approved contract explicitly permits them with human confirmation.
- Hooks must emit clear denial reasons that can be included in LoopPilot audit output.

### 7.2 Required user confirmation

A user must confirm before:

- installing or enabling Claude permission hooks;
- binding a LoopPilot contract to a Claude Code session;
- allowing hooks to approve any write action;
- changing hook policy, command allowlists, path allowlists, or denial behavior;
- proceeding after a hook denial;
- exporting hook audit output outside the local workspace.

### 7.3 Audit output

Hook audit output must include:

- active LoopPilot contract identifier or inline contract hash;
- Claude Code session or workspace identifier when available;
- hook policy version;
- permission request summary;
- contract rule matched;
- allow/deny decision and reason;
- user confirmations involved;
- commands, paths, and tool names requested;
- final action status.

### 7.4 Stop conditions

Claude permission hook orchestration must stop when:

- no active LoopPilot contract is bound;
- a requested action is outside the contract;
- the hook cannot determine whether an action is safe;
- Claude Code permission state conflicts with LoopPilot contract state;
- a user denies a required permission;
- hook audit output cannot be recorded;
- the contract expires, reaches max iterations, or fails its verifier gate.

---

## 8. v1 stability gates required before v2 implementation

No v2 implementation code should be added until the following v1 artifacts and verifier gates are stable:

- qualification rules are stable and versioned;
- decision schema has compatibility tests and drift checks;
- contract template has verifier coverage;
- fixtures cover high-risk and orchestration-adjacent cases;
- wrapper parity checks pass for supported hosts;
- scan, export, save, and report behavior is documented and tested;
- audit-output requirements are represented in fixtures or verifier tests;
- stop-condition behavior is tested for all executable decisions;
- documentation clearly distinguishes LoopPilot qualification from execution hosts.

Until those gates are stable, allowed v2 work is limited to:

- documentation;
- threat models;
- taxonomy and fixture design;
- verifier requirements;
- review checklists;
- non-executable examples.
