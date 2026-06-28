# LoopPilot Technical Design v0.2：Agent-native Loop Check

**版本**：v0.2 rewrite
**日期**：2026-06-25  
**技术定位**：LoopPilot 不是独立 agent、runner 或 provider adapter。MVP 是 Codex / Claude Code 原生的 loop-check + loop contract 生成流程：先判断任务是否适合 loop，再让当前 agent 按明确 contract 执行。

---

## 1. 技术原则

1. **Agent-native first**：用户在 Codex 或 Claude Code 中发起，当前 agent 直接执行。
2. **Check before loop**：任何循环执行前必须先给出 `RUN_WITH_CONTRACT` / `PLAN_ONLY` / `NO_GO`。
3. **Contract before action**：`RUN_WITH_CONTRACT` 前必须展示 loop contract。
4. **Current agent executes**：LoopPilot 不实现 runner，不维护长期执行器。
5. **Files as optional memory**：文件用于审计和复用，不是执行前提。
6. **Export is fallback**：导出给 GitHub/其他 agent 是备用路径，不是主路径。
7. **No hidden provider**：不接独立 AI provider；复用当前 Codex / Claude Code 能力。
8. **Shared core, thin wrappers**：规则和模板只维护一份，Codex / Claude Code 只做入口适配。
9. **Eval before execution**：先用 fixture 验证 decision 质量，再做任何执行体验。
10. **Schema first**：先输出可校验 JSON，再输出人话解释。
11. **Chat-first by default**：默认只在当前 session 输出，不写文件；保存文件必须由用户明确要求。
12. **One clarification max**：最多澄清一次，仍不明确则 `PLAN_ONLY`。

---

## 2. 架构概览

```text
User in Codex / Claude Code
  |
  v
Agent wrapper
  - Codex skill
  - Claude Code skill / command
  |
  v
Shared LoopPilot core
  - parse goal
  - use current context
  - optionally use scan evidence
  - apply risk rules
  - classify RUN_WITH_CONTRACT / PLAN_ONLY / NO_GO
  - emit schema-valid JSON decision
  |
  v
Loop Contract
  - goal
  - scope
  - allowed / forbidden actions
  - gate
  - stop conditions
  - max rounds
  |
  v
Current agent execution
  - current session executes contract
  - stops on gate/pass/risk/budget/user
  - outputs report
```

Optional file outputs:

```text
.looppilot/
  core/
    qualification-rules.md
    decision-schema.json
    contract-template.md
    report-template.md
    vision-template.md
    state-template.md
    run-log-template.md
    review-gate-template.md
  fixtures/
    decision-fixtures.jsonl
  latest-contract.md       # explicit save only
  latest-report.md         # explicit save only
  latest-review-gate.md    # explicit save only
  VISION.md                # explicit v1 artifact save only
  STATE.md                 # explicit v1 artifact save only
  RUN_LOG.md               # explicit v1 artifact save only
  exports/
    RUN_IN_CODEX.md
    RUN_IN_CLAUDE.md
    github-issue.md

.agents/
  skills/
    looppilot/
      SKILL.md

.claude/
  skills/
    looppilot/
      SKILL.md
  commands/
    should-loop.md
```

MVP does not include:

- background daemon
- CLI-first product surface
- scheduled runner
- GitHub issue queue
- automatic GitHub issue scanning or execution
- model provider registry
- external Python/bash loop runner
- durable orchestration

---

## 3. Agent-native Flow

### 3.1 Entry

User asks in Codex or Claude Code:

```text
Can this task be a loop?
```

or:

```text
帮我判断这个任务能不能 loop，然后安全执行。
```

### 3.2 Flow

1. Read user goal.
2. Use current agent context and optional scan evidence.
3. Apply loop qualification rules.
4. Ask at most one clarifying question if the task is nearly classifiable.
5. Return schema-valid JSON decision.
6. Render human-readable explanation.
7. If `RUN_WITH_CONTRACT`, render loop contract.
8. Ask for confirmation unless the user already explicitly confirmed.
9. Current agent session executes the contract.
10. Current agent writes final report in chat.
11. Write latest files or v1 manual artifacts only if the user explicitly asked to save them.

### 3.3 Why no runner?

Codex and Claude Code already have:

- code reading
- file editing
- command execution
- approvals
- sandbox behavior
- user interaction
- final reporting

If LoopPilot adds its own runner, it duplicates the host agent and must own execution bugs, logging, permissions, timeouts, retries, and state. MVP avoids that.

### 3.4 Delivery surfaces

LoopPilot v0 should ship as a repo-local Agent Pack:

| Surface | Path | Role |
|---|---|---|
| Shared core | `.looppilot/core/` | Single source of truth for rules, schema, and contract template |
| Decision schema | `.looppilot/core/decision-schema.json` | Machine-checkable output contract |
| Decision fixtures | `.looppilot/fixtures/decision-fixtures.jsonl` | Regression set for qualification behavior |
| Codex wrapper | `.agents/skills/looppilot/SKILL.md` | Codex-native invocation |
| Claude Code wrapper | `.claude/skills/looppilot/SKILL.md` | Claude Code native invocation |
| Claude command alias | `.claude/commands/should-loop.md` | Optional alias that references the Claude skill; no duplicated logic |
| Scan helper | `.looppilot/scripts/scan-summary.*` | Optional read-only evidence summary |
| Issue intake helper | `.looppilot/scripts/issue-intake.mjs` | Optional read-only single GitHub issue packet for the current agent |

Wrappers must not duplicate the decision logic. They should import or reference the same shared core text. If wrappers diverge, the product becomes unsafe because the same task may receive different decisions in different agents.

---

## 4. Decision Model

Every decision must first be emitted as JSON that validates against `.looppilot/core/decision-schema.json`. Markdown explanation may follow, but tests should validate the JSON block.

### 4.1 `NO_GO`

Return `NO_GO` when any hard blocker is present:

- goal is too broad
- no objective gate
- requests production deploy / publish
- requests delete/drop/destructive action
- touches auth/payment/permission without narrow scope
- asks to “keep going until everything is perfect”
- requires business judgment rather than engineering verification

Output fields:

```json
{
  "decision": "NO_GO",
  "confidence": "high",
  "needs_clarification": false,
  "clarifying_question": null,
  "host_capabilities": {
    "host": "codex",
    "can_edit_files": true,
    "can_run_commands": true,
    "has_approval_flow": true,
    "capability_confidence": "known"
  },
  "reasons": [],
  "safe_alternative": "",
  "next_prompt": "",
  "contract": null
}
```

### 4.2 `PLAN_ONLY`

Return `PLAN_ONLY` when task may become a loop but should not execute yet:

- scope is large but decomposable
- code changes are needed but files/gate are unclear
- test command is missing
- dependency install is requested
- risky module is involved but user asks for analysis first

Output fields:

```json
{
  "decision": "PLAN_ONLY",
  "confidence": "medium",
  "needs_clarification": false,
  "clarifying_question": null,
  "host_capabilities": {
    "host": "claude_code",
    "can_edit_files": true,
    "can_run_commands": true,
    "has_approval_flow": true,
    "capability_confidence": "known"
  },
  "reasons": [],
  "plan_outputs": ["risk_analysis", "task_breakdown", "candidate_gate"],
  "required_user_confirmation": [],
  "contract": null
}
```

### 4.3 `RUN_WITH_CONTRACT`

Return `RUN_WITH_CONTRACT` only when all minimum conditions hold:

- goal is narrow
- objective gate exists
- stop conditions are clear
- forbidden actions are explicit
- max rounds is bounded
- risk is low or user-confirmable

Output fields:

```json
{
  "decision": "RUN_WITH_CONTRACT",
  "confidence": "high",
  "needs_clarification": false,
  "clarifying_question": null,
  "host_capabilities": {
    "host": "codex",
    "can_edit_files": true,
    "can_run_commands": true,
    "has_approval_flow": true,
    "capability_confidence": "known"
  },
  "reasons": [],
  "contract": {}
}
```

---

## 5. Host Capability Profile

LoopPilot must account for the host agent before returning `RUN_WITH_CONTRACT`.

Shape:

```json
{
  "host": "codex",
  "can_edit_files": true,
  "can_run_commands": true,
  "has_approval_flow": true,
  "supports_skills_or_commands": true,
  "capability_confidence": "known"
}
```

Allowed `host` values:

- `codex`
- `claude_code`
- `unknown`

Rules:

- If `capability_confidence` is `unknown`, return `PLAN_ONLY`.
- If file editing is needed but `can_edit_files` is false or unknown, return `PLAN_ONLY`.
- If command gate is required but `can_run_commands` is false or unknown, return `PLAN_ONLY`.
- If a risky action requires approval but `has_approval_flow` is false or unknown, return `PLAN_ONLY` or `NO_GO`.
- Host profile is not user trust. It only describes available execution controls.

---

## 6. Qualification Rules

### 6.1 Two-condition test

Borrowing from loop-harness, a task deserves a loop only if:

1. **Verification is objective enough**: a command, file output, checklist, or clearly testable report can say pass/fail.
2. **Waste is bounded**: max rounds, time, and scope prevent unbounded exploration.

If either fails, return `NO_GO` or `PLAN_ONLY`.

### 6.2 Risk keywords

English:

```text
auth, payment, billing, checkout, permission, admin, production,
deploy, publish, delete, drop, migration, secret, token, credential
```

Chinese:

```text
支付、账单、结账、鉴权、权限、管理员、生产、上线、发布、
部署、删除、清空、迁移、数据库、密钥、凭证、token
```

### 6.3 Hard defaults

| Signal | Default |
|---|---|
| no objective gate | `PLAN_ONLY` or `NO_GO` |
| destructive action | `NO_GO` |
| deploy/publish | `NO_GO` |
| auth/payment code changes | `PLAN_ONLY` or `NO_GO` |
| dependency install | `PLAN_ONLY` |
| commit/push request | require explicit confirmation; MVP default no |
| max rounds missing | ask user or default to 3 |
| unknown host capabilities | `PLAN_ONLY` |

### 6.4 Clarification rule

Clarification is limited:

- Ask at most one clarifying question.
- Ask only when one answer can unlock a safe classification.
- If still unclear, return `PLAN_ONLY`.
- Never use clarification to override hard safety defaults.

---

## 7. Repo Context Scan

Repo scan is optional evidence, not a v0 dependency. MVP must work from the user goal and current agent context even when scan is unavailable.

If implemented, scan should be small. It exists to help the current agent decide, not to fully understand the codebase.

Read:

- `git status --short`
- changed file names and diff stats
- root files: `package.json`, `pyproject.toml`, `go.mod`, `pom.xml`
- README title / short summary
- test/build command candidates
- risk path names: `auth`, `payment`, `billing`, `admin`, `secrets`

Do not read by default:

- `.env`
- `.env.*`
- `*.pem`
- `*.key`
- `secrets/**`
- `.ssh/**`
- `.aws/**`
- full source tree
- full diff

MVP scan result:

```json
{
  "repo": {
    "dirty": true,
    "changed_files": [],
    "diff_stat": ""
  },
  "project": {
    "languages": [],
    "test_commands": [],
    "build_commands": []
  },
  "risk": {
    "risk_paths": [],
    "sensitive_candidates": []
  }
}
```

---

## 8. Loop Contract

Contract is the handoff between LoopPilot and the current agent execution.

Shape:

```json
{
  "decision": "RUN_WITH_CONTRACT",
  "host_capabilities": {
    "host": "codex",
    "can_edit_files": true,
    "can_run_commands": true,
    "has_approval_flow": true,
    "capability_confidence": "known"
  },
  "goal": "Fix the current failing test",
  "scope": {
    "include": ["src/**", "tests/**"],
    "exclude": [".env", "secrets/**", "dist/**"]
  },
  "allowed_actions": [
    "read_files",
    "edit_small_scope",
    "run_test_command"
  ],
  "forbidden_actions": [
    "edit_secrets",
    "change_auth_or_payment",
    "install_dependencies",
    "git_commit",
    "git_push",
    "deploy"
  ],
  "gate": {
    "type": "command",
    "command": "npm test",
    "expect": "exit_zero"
  },
  "stop_conditions": [
    "gate_passes",
    "max_rounds_reached",
    "same_failure_twice",
    "forbidden_action_needed",
    "user_interrupt"
  ],
  "max_rounds": 5,
  "human_confirmations": [
    "dependency_install",
    "large_diff",
    "config_change"
  ],
  "report": [
    "what_changed",
    "commands_run",
    "gate_result",
    "risks_or_blockers",
    "next_steps"
  ]
}
```

For chat display, render as Markdown before execution.

### 8.1 Contract invariants

These invariants must hold regardless of Codex or Claude Code:

- Same input fixture should produce same `decision`.
- Same `RUN_WITH_CONTRACT` fixture should produce semantically equivalent `gate`, `stop_conditions`, and `forbidden_actions`.
- Wrapper-specific wording may differ, but safety policy cannot differ.
- If host-agent capabilities are unknown, downgrade to `PLAN_ONLY`.
- If scan helper fails, continue with user-provided context and mark confidence lower; do not silently assume safety.
- Decision JSON must validate before execution.
- Contract is displayed in chat before any action.

---

## 9. Agent Execution Protocol

When decision is `RUN_WITH_CONTRACT`, the current agent must follow this protocol:

1. Restate the contract.
2. Ask for confirmation unless the user already explicitly confirmed.
3. Work one round at a time.
4. After each round, run the gate if safe and available.
5. Stop immediately on any stop condition.
6. Do not broaden scope without asking.
7. Final answer must include report fields.
8. Do not write `.looppilot/latest-contract.md`, `.looppilot/latest-report.md`, `.looppilot/latest-review-gate.md`, `.looppilot/VISION.md`, `.looppilot/STATE.md`, or `.looppilot/RUN_LOG.md` unless the user asked to save them.

The agent should not self-approve a widened scope. If the contract needs to change, stop and ask.

### 9.1 Codex surface

Codex can execute the contract directly in the current session. Optional export file:

```text
.looppilot/exports/RUN_IN_CODEX.md
```

Recommended repo-local wrapper:

```text
.agents/skills/looppilot/SKILL.md
```

### 9.2 Claude Code surface

Claude Code can execute the same contract directly in the current session or through a generated slash-command-style handoff. Optional export file:

```text
.looppilot/exports/RUN_IN_CLAUDE.md
```

Recommended repo-local wrapper:

```text
.claude/skills/looppilot/SKILL.md
.claude/commands/should-loop.md
```

The command file should only call or reference the skill. It must not duplicate qualification rules.

The contract content must stay the same across Codex and Claude Code. Only the wrapper wording changes.

---

## 10. Optional Files

Files are optional in MVP. They help with audit and reuse, but default behavior is chat-first.

Do not write these files unless the user explicitly asks to save the contract, save the report, save review-gate evidence, save v1 manual artifacts, or export a handoff.

### 10.1 `.looppilot/latest-contract.md`

Human-readable contract for the current task.

### 10.2 `.looppilot/latest-report.md`

Final report from the latest agent execution.

### 10.3 `.looppilot/latest-review-gate.md`

Latest explicit review-gate evidence. This is not an approval gate, deployment gate, release gate, or permission to merge/push/deploy.

### 10.4 v1 manual artifacts

Only generated on request:

```text
.looppilot/VISION.md
.looppilot/STATE.md
.looppilot/RUN_LOG.md
```

These are human-authored reusable artifacts. They are not background runner state, daemon checkpoints, scheduler inputs, or automatic execution records.

### 10.5 Export files

Only generated on request:

```text
.looppilot/exports/RUN_IN_CODEX.md
.looppilot/exports/RUN_IN_CLAUDE.md
.looppilot/exports/github-issue.md
```

Export files are not controlled execution. They are instructions for another agent/user workflow.

### 10.6 Future trajectory-lite audit artifact

LoopPilot should consider a future optional `trajectory-lite` artifact, inspired by autonomous issue-fixing tools but scoped to user-visible facts only.

It may record:

- original user input or issue URL;
- context sources read, such as issue metadata or scan summary;
- incomplete-context warnings;
- final `NO_GO` / `PLAN_ONLY` / `RUN_WITH_CONTRACT` decision;
- proposed verifier gate and stop conditions;
- user confirmations requested and received;
- command names and result summaries when the current agent executes a contract.

It must not record:

- hidden chain-of-thought or private model reasoning;
- secrets, token values, private environment variables, or raw credential-bearing logs;
- enough command output to become a log dump;
- any runner state that implies automatic resume.

This is not part of the `0.2.0` release-ready surface. It is a candidate for a later auditability-focused release after the issue-intake flow is stable.

---

## 11. CLI / Command Surface

MVP can be implemented without a standalone CLI, but if we provide one, it should mirror agent-native behavior.

Agent-native first:

```text
User: should this loop?
Codex / Claude Code: runs LoopPilot check inline
```

Current helper CLI:

```bash
looppilot install --target both --scope project
looppilot doctor --target both --json
looppilot scan
looppilot host-capabilities
looppilot claude-project-summary
looppilot issue-intake --url https://github.com/owner/repo/issues/123
looppilot issue-intake --repo owner/repo --number 123
looppilot export --target codex
looppilot export --target claude
looppilot export --target github-issue
looppilot save-contract --from /path/to/contract.md
looppilot save-report --from /path/to/report.md
looppilot save-review-gate --from /path/to/review-gate.md
looppilot save-vision --from /path/to/vision.md
looppilot save-state --from /path/to/state.md
looppilot save-run-log --from /path/to/run-log.md
```

No MVP command should be named `run`, because execution belongs to the current agent. A `check` command is also not part of the current release-ready surface; decision execution remains agent-native through Codex and Claude Code wrappers.

`issue-intake` is an internal helper/debug surface, not the primary UX. The primary UX remains:

```text
Claude Code: /should-loop https://github.com/owner/repo/issues/123
Codex: Use LoopPilot on https://github.com/owner/repo/issues/123
```

The helper reads only one issue endpoint, redacts obvious secrets, marks `possibly_incomplete` when comments, comment anchors, truncation, or issue text suggest omitted context may matter, and leaves all semantic judgment to the current Codex or Claude Code session.

---

## 12. Test Strategy

### 12.1 Decision fixtures

At least 45 fixtures:

- 15 `NO_GO`
- 15 `PLAN_ONLY`
- 15 `RUN_WITH_CONTRACT`

Each fixture includes:

- user goal
- repo summary
- expected decision
- expected reasons
- expected forbidden actions
- expected gate presence
- expected stop conditions
- expected host capability requirements
- expected clarification behavior

### 12.2 Schema validation tests

For every fixture:

- extract the first JSON decision block
- validate against `.looppilot/core/decision-schema.json`
- reject extra unsafe actions not allowed by the schema
- reject `RUN_WITH_CONTRACT` without known host capabilities

Schema validation is a release gate.

### 12.3 Wrapper parity tests

For every fixture:

- run the Codex wrapper prompt against the shared core
- run the Claude Code wrapper prompt against the shared core
- normalize output to the decision schema
- assert same `decision`
- assert safety-critical fields match for `RUN_WITH_CONTRACT`

Wrapper parity is a release gate. If Codex and Claude Code disagree on safety classification, the fixture fails.

### 12.4 Safety tests

Must cover:

- payment/auth/deploy tasks do not return `RUN_WITH_CONTRACT`
- no gate means no `RUN_WITH_CONTRACT`
- missing max rounds defaults to safe cap or asks user
- secrets are excluded from scan
- `RUN_WITH_CONTRACT` contract always has gate
- `RUN_WITH_CONTRACT` contract always has stop conditions
- export output says it is not controlled execution
- unknown host capabilities return `PLAN_ONLY`
- more than one clarification is never required
- default flow does not write files

---

## 13. Implementation Order

1. Define `.looppilot/core/qualification-rules.md`.
2. Define `.looppilot/core/decision-schema.json`.
3. Define `.looppilot/core/contract-template.md`.
4. Write 45 decision fixtures before building UX.
5. Implement a tiny fixture validator for schema and expected fields.
6. Create Codex wrapper at `.agents/skills/looppilot/SKILL.md`.
7. Create Claude Code wrapper at `.claude/skills/looppilot/SKILL.md`.
8. Add `.claude/commands/should-loop.md` as an alias only.
9. Add optional read-only scan helper.
10. Add optional explicit-save files.
11. Add optional export files.

Do not implement:

- background runner
- full CLI before wrapper parity is stable
- model provider registry
- GitHub scheduler
- long-lived state machine
- token accounting
- default file writes

---

## 14. References

- `breim/loop-harness`: qualification gate, NO-GO first, state/vision/verifier methodology.
- `ksimback/looper`: loop design layer, `RUN_IN_SESSION.md`, explicit verification and stop guards.
- `iannuttall/ralph`: files and git as memory, replaceable agent command.
- `federiconeri/wiggum-cli`: scan/spec/delegate pattern for Claude Code and Codex.
- Claude Code official docs: skills live under `.claude/skills/<skill-name>/SKILL.md`; `.claude/commands/` remains compatible, but skills are the recommended richer form. See https://code.claude.com/docs/en/skills.

---

## 15. Final Technical Definition

**LoopPilot MVP is an agent-native Agent Pack for Codex and Claude Code. It keeps one shared core for qualification rules, decision schema, contract templates, and fixtures; exposes thin wrappers for each host agent; emits schema-valid JSON before explanation; classifies a task as `RUN_WITH_CONTRACT`, `PLAN_ONLY`, or `NO_GO`; renders a loop contract; and lets the current agent session execute that contract. It does not run loops itself and does not write files by default.**
