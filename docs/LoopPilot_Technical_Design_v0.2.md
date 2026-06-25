# LoopPilot Technical Design v0.2：判断优先，安全执行后置

**版本**：v0.2  
**日期**：2026-06-25  
**技术定位**：LoopPilot MVP 不是 agent 执行器，而是 loop decision layer + spec compiler + readonly audit runner。它默认不控制 Claude Code / Codex 的内部执行，因此 export/prompt 模式不能称为受控执行。

---

## 1. 技术原则

1. **不重造 agent**：不替代 Claude Code、Codex、Cursor。
2. **判断优先**：核心价值是判断任务该不该 loop。
3. **安全承诺与执行能力匹配**：不能强制拦截的路径，只能叫 export/prompt。
4. **默认只读**：MVP 真实执行只允许元信息级只读巡检。
5. **写操作 dry-run**：涉及写代码、依赖安装、commit、push、部署等动作，只生成计划、change plan 或 patch outline；具体 patch proposal 需要用户显式开启 `--include-code`。
6. **隐私预览先于模型调用**：任何发给模型的内容都必须可见、可解释、可选择。
7. **强制限制用本地可控指标**：文件数、diff 行数、运行时间、轮次；token 只做估算。

---

## 2. 架构概览

```text
┌─────────────────────────────────────────────┐
│ CLI                                         │
│ ask / scan / recommend / create / run       │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│ Project Scanner                              │
│ git metadata / structure / config / diff     │
│ no secret content read                       │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│ Privacy Packager                             │
│ summarize / redact / preview / opt-in        │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│ Decision Engine                              │
│ rules first + optional LLM explanation       │
│ NO_LOOP / READONLY_BRIEF / AUDIT / DRY_RUN   │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│ Spec Compiler                                │
│ loop.yaml / run.md / report-template.md      │
└─────────────────────┬───────────────────────┘
                      │
      ┌───────────────┴────────────────┐
      │                                │
┌─────▼─────────────┐          ┌───────▼────────────┐
│ Export Adapter     │          │ Readonly Runner     │
│ Claude/Codex prompt│          │ internal audit only  │
│ no enforcement     │          │ no project writes    │
└────────────────────┘          └──────────────────────┘
```

MVP 不包含真正的 scheduled runner、event runner、Claude hooks 强制拦截、Codex sandbox 强制校验。那些放到 v1。

---

## 3. 技术选型

| 模块 | MVP 方案 | 说明 |
|---|---|---|
| CLI | TypeScript + Node.js | npm 分发简单，适合本地开发者工具 |
| 配置格式 | YAML + Markdown | 人可读，方便复制给 agent |
| 项目扫描 | Node fs + git 命令 + 规则检测 | 轻量可控 |
| 决策引擎 | 规则优先，可选 LLM | 高风险判断不能完全依赖 LLM |
| 模型调用 | 用户显式配置后调用 | 默认展示 privacy preview |
| 执行 | Internal readonly runner + export adapter | 不默认调用外部 agent 自动写代码 |
| 状态存储 | `.looppilot/` | 本地透明 |
| 日志 | JSONL + Markdown report | 便于复盘 |
| 安全 | 本地规则 + 只读执行边界 | MVP 不承诺外部 CLI 强制拦截 |

---

## 4. CLI 设计

### 4.1 命令

```bash
looppilot ask "帮我看看这个项目有没有明显风险"
looppilot scan
looppilot recommend "帮我修复失败测试"
looppilot create --from .looppilot/recommendations/latest.json --export-only
looppilot run --readonly .looppilot/loops/code-health/loop.yaml
```

### 4.2 命令职责

| 命令 | 职责 |
|---|---|
| `ask` | 一步完成扫描、隐私预览、推荐、生成建议 |
| `scan` | 只扫描本地项目信息，不调用模型 |
| `recommend` | 输出是否适合 loop 的判断 |
| `create` | 生成 loop spec 和外部工具 prompt |
| `run --readonly` | 只读执行一次巡检并生成报告 |

---

## 5. 决策类型

MVP 有 3 类主决策，以及 1 个高风险降级状态。

### 5.1 NO_LOOP

适用：

- 目标一次性完成即可。
- 验收标准不清晰。
- 风险高。
- 涉及支付、鉴权、权限、生产环境、部署、删除数据。

行为：

- 不生成可执行 loop。
- 生成单次 prompt 或拆解建议。
- 解释为什么不该 loop。

### 5.2 NO_LOOP_WITH_READONLY_BRIEF

适用：

- 任务不适合 loop。
- 风险高，不能进入标准 audit runner。
- 仍然可以基于目录结构、配置摘要、diff 摘要给出低风险提示。

行为：

- 不生成可执行 loop。
- 不调用写操作或外部 agent。
- 只输出元信息级风险 brief。
- 报告必须明确 `coverage` 和 `blind_spots`，避免用户把 brief 理解为完整审计。

### 5.3 MANUAL_READONLY_AUDIT

适用：

- 只读检查。
- 目标是报告，不是修改。
- 可以通过文件结构、diff 摘要、配置摘要、测试候选等元信息给出结论。

行为：

- 允许 `run --readonly` 真实执行。
- 不写项目文件。
- 只写 `.looppilot/runs/<id>/report.md`。

### 5.4 SHORT_LOOP_DRY_RUN

适用：

- 目标相对明确。
- 有测试或可验证条件。
- 但需要写代码、改配置或跑外部命令。

行为：

- 不自动改项目。
- 生成 dry-run plan、change plan、patch outline、Claude/Codex prompt。
- 只有用户显式开启 `--include-code` 后，才允许生成具体 patch proposal。
- 要求用户手动复制或在外部工具里确认。

---

## 6. Project Scanner

### 6.1 扫描内容

| 内容 | 处理方式 |
|---|---|
| Git 状态 | 读取 branch、dirty state、recent commits 摘要 |
| 目录结构 | 生成 tree summary，限制深度和文件数 |
| 项目类型 | package.json、pyproject.toml、go.mod、pom.xml 等 |
| README | 默认提取标题和摘要，不发送全文 |
| 测试命令候选 | 从 scripts、CI、常见文件推断 |
| 构建命令候选 | 从 scripts、CI 推断 |
| diff | 默认仅文件名、变更行数、风险标签 |
| 敏感文件候选 | 只记录路径和类型，不读取内容 |

### 6.2 永不读取内容的文件

默认不读取：

```text
.env
.env.*
*.pem
*.key
*.p12
*.crt
id_rsa
id_ed25519
**/secrets/**
**/.aws/**
**/.ssh/**
```

### 6.3 扫描输出

```json
{
  "project_type": "node-typescript",
  "git": {
    "branch": "main",
    "dirty": true,
    "changed_files_count": 8
  },
  "commands": {
    "test_candidates": ["npm test"],
    "build_candidates": ["npm run build"]
  },
  "risk_signals": [
    "dirty_worktree",
    "has_auth_related_files",
    "missing_test_script"
  ],
  "sensitive_candidates": [
    ".env",
    "private.key"
  ]
}
```

---

## 7. Privacy Packager

### 7.1 分级策略

| 级别 | 内容 | 默认处理 |
|---|---|---|
| L0 | 技术栈、文件数量、目录结构摘要 | 可进入模型上下文 |
| L1 | 依赖名、脚本名、CI 类型 | 脱敏后可进入模型上下文 |
| L2 | README 摘要 | 可进入模型上下文 |
| L3 | diff 摘要 | 只发文件名、行数、风险标签 |
| L4 | 代码片段、完整 diff | 默认不发送，需 opt-in |
| L5 | secrets、密钥、生产配置 | 永不发送，默认不读取 |

### 7.2 隐私预览

任何模型调用前生成：

```text
.looppilot/privacy-preview.md
```

内容包括：

- 将发送的字段。
- 不会发送的字段。
- 检测到但不读取的敏感文件。
- 用户可选开关。

示例：

```text
本次将发送：
- 项目类型：Node.js / TypeScript
- 目录结构摘要：最大 200 行
- package.json scripts 和依赖名
- 最近 diff 摘要：文件名 + 变更行数

不会发送：
- 完整源码
- 完整 diff
- .env 内容
- 私钥 / token / 证书

如需发送具体代码片段，请重新运行：
looppilot recommend --include-code
```

### 7.3 模型调用状态机

模型调用必须经过以下状态：

```text
scan_local
  -> build_privacy_preview
  -> choose_privacy_mode
  -> confirm_or_skip_model
  -> run_rules
  -> optional_llm_explanation
  -> write_recommendation
```

隐私模式：

| 模式 | 是否调用模型 | 可发送内容 |
|---|---|---|
| `local-only` | 否 | 不发送任何内容 |
| `interactive` | 用户确认后调用 | L0-L3 摘要 |
| `send-summary` | 命令行显式允许 | L0-L3 摘要 |
| `include-code` | 命令行显式允许，仍需预览 | 必要 L4 片段；L5 仍永不读取 |

如果用户未确认，系统必须继续给出规则层推荐，但不得调用模型生成解释。

---

## 8. Decision Engine

### 8.1 规则优先

高风险任务先由规则层拦截或降级，不等 LLM 决定。

高风险关键词和信号：

- payment、billing、checkout、auth、permission、admin、production、deploy、delete、drop、migration。
- 支付、账单、结账、鉴权、权限、管理员、生产、上线、发布、部署、删除、清空、迁移、数据库、密钥。
- 用户要求“自动提交”“自动上线”“自动发布”“一直跑到没问题”“修到全部没问题”。
- 缺少可验证条件。
- 工作区有大量未提交改动。
- 涉及敏感文件候选。

高风险降级规则：

- 如果任务要求自动修改、上线、发布、删除数据或处理资金链路，返回 `NO_LOOP`。
- 如果任务要求检查高风险区域，但不要求修改，返回 `NO_LOOP_WITH_READONLY_BRIEF`。
- 如果任务目标是只读项目健康检查，且没有高风险区域写入意图，才允许返回 `MANUAL_READONLY_AUDIT`。

### 8.2 LLM 的作用

LLM 只做：

- 解释推荐理由。
- 根据扫描摘要生成用户可读建议。
- 帮助选择更合适的人话命名。

LLM 不单独决定：

- 是否允许写操作。
- 是否允许读取敏感文件。
- 是否允许运行外部命令。
- 是否允许进入受控执行。

### 8.3 输出结构

```json
{
  "decision_type": "MANUAL_READONLY_AUDIT",
  "confidence": 0.82,
  "reasons": [
    "任务目标是检查风险，不要求自动修改",
    "输出可以是报告",
    "风险可控"
  ],
  "downgraded_from": null,
  "requires_user_confirmation": true,
  "privacy_mode": "interactive",
  "recommended_mode": "readonly_internal_run",
  "coverage": [
    "repo_metadata",
    "safe_config_summary",
    "diff_summary"
  ],
  "blind_spots": [
    "full_source_code",
    "test_execution",
    "dependency_vulnerability_scan"
  ]
}
```

---

## 9. Loop Spec

### 9.1 loop.yaml 示例

```yaml
version: 0.2
name: code-health-audit
decision_type: MANUAL_READONLY_AUDIT
mode: manual_readonly_audit
execution_mode: internal_readonly

goal: >
  Check whether the current repository has obvious health or risk issues.

trigger:
  type: manual
  schedule: null

context_policy:
  privacy_mode: interactive
  default_send_level: L3
  include_code: false
  include_full_diff: false
  never_read:
    - .env
    - "*.pem"
    - "*.key"

allowed_actions:
  - read_repo_metadata
  - read_safe_config_summary
  - read_diff_summary
  - create_report

forbidden_actions:
  - write_project_files
  - install_dependencies
  - git_commit
  - git_push
  - deploy
  - read_secrets

verification:
  output_required:
    - risk_summary
    - evidence
    - suggested_next_steps
    - coverage
    - blind_spots

stop_condition:
  max_rounds: 1
  max_runtime_seconds: 300
  max_files_scanned: 500
  max_diff_lines: 2000

budget_estimate:
  estimated_tokens: 20000
  enforceable: false
  enforceable_limits:
    - max_runtime_seconds
    - max_files_scanned
    - max_diff_lines

user_confirmation:
  required_before_model_call: true
  required_before_write: true

report:
  path: .looppilot/runs/latest/report.md
```

### 9.2 Spec 校验规则

任何 spec 必须包含：

- `decision_type`
- `execution_mode`
- `context_policy`
- `forbidden_actions`
- `stop_condition`
- `budget_estimate.enforceable`
- `user_confirmation`
- `verification.output_required` 中的 `coverage`
- `verification.output_required` 中的 `blind_spots`

缺失则不允许执行。

---

## 10. 执行模式

### 10.1 Export / Prompt Mode

生成给 Claude Code / Codex 的文件：

```text
.looppilot/loops/<name>/run.md
.looppilot/loops/<name>/codex-prompt.md
```

明确文案：

> 这是 export/prompt 模式。LoopPilot 无法强制 Claude Code / Codex 遵守安全策略。请在外部工具中确认执行权限。

### 10.2 Internal Read-only Run

LoopPilot 自己执行：

- 项目扫描。
- 风险规则检查。
- 可选 LLM 解释。
- 报告生成。

它不执行：

- 文件写入项目目录。
- 依赖安装。
- 测试命令。
- 完整源码审计。
- 完整 diff 审计。
- git commit / push。
- 部署。

它只能通过 Project Scanner 的安全读取接口访问文件。读取前必须先应用 `never_read` denylist；默认只读取安全配置摘要、README 摘要、目录结构摘要和 diff 摘要。

唯一允许写入：

```text
.looppilot/runs/<run-id>/report.md
.looppilot/runs/<run-id>/log.jsonl
```

### 10.3 Controlled Execution（v1+）

只有同时满足以下条件，才可称为受控执行：

1. 能检测外部工具的安全能力。
2. 能验证 sandbox / approval / hooks 已启用。
3. 能确认危险动作会被拦截或要求人工确认。
4. 能记录执行日志。
5. 能在超时、超轮次、超文件数时停止。

MVP 不实现。

---

## 11. 成本控制

### 11.1 MVP 可强制限制

- `max_runtime_seconds`
- `max_rounds`
- `max_files_scanned`
- `max_diff_lines`
- `max_report_chars`

### 11.2 MVP 不可强制限制

- 外部 CLI 实际 token。
- 订阅模型实际用量。
- Claude/Codex 内部工具调用次数。

文案必须说明：

> token 是估算，不是硬限制。只有当执行路径提供预算拦截能力时，才能称为 token hard limit。

---

## 12. 报告设计

Readonly audit report 包含：

```markdown
# LoopPilot Read-only Audit Report

## Summary

## Decision
- decision_type:
- confidence:
- why:

## What I checked

## What I did not check

## Coverage

## Blind spots

## Risks found

## Evidence

## Suggested next steps

## Privacy
- sent_to_model:
- not_sent:
- sensitive_candidates_not_read:

## Limits
- max_runtime_seconds:
- max_files_scanned:
- max_diff_lines:
- token_estimate:
```

---

## 13. 开发里程碑

### Week 1：CLI 和扫描

- 建 TypeScript CLI。
- 实现 `scan`。
- 实现敏感文件识别。
- 生成 `project-scan.json`。
- 生成 `privacy-preview.md`。

### Week 2：决策和 spec

- 实现规则层。
- 实现中英文高风险关键词和降级规则。
- 实现三类主决策和 `NO_LOOP_WITH_READONLY_BRIEF` 降级状态。
- 实现 `recommend`。
- 实现 `loop.yaml` schema。
- 完成至少 50 个任务测试集。

### Week 3：Export 和只读执行

- 实现 `create --export-only`。
- 生成 Claude / Codex prompt。
- 实现 `run --readonly`。
- 生成报告和 JSONL 日志。

### Week 4：打磨和验证

- 优化人话解释。
- 加入隐私确认交互。
- 补齐 `local-only`、`interactive`、`send-summary`、`include-code` 四种隐私模式。
- 补充危险任务测试集。
- 写 README 和 examples。

MVP 不做双 adapter 自动执行，不做 hooks，不做 scheduled，不做 event-driven。

---

## 14. 测试策略

### 14.1 决策测试集

至少包含：

- 10 个 NO_LOOP。
- 10 个 NO_LOOP_WITH_READONLY_BRIEF。
- 10 个 MANUAL_READONLY_AUDIT。
- 10 个 SHORT_LOOP_DRY_RUN。
- 10 个危险任务拒绝 / 降级案例。

### 14.2 安全测试

必须覆盖：

- `.env` 不读取。
- `*.pem` 不读取。
- 完整代码默认不发送。
- 完整 diff 默认不发送。
- `--include-code` 未开启时不生成具体 patch proposal。
- 写操作不能进入 `internal_readonly`。
- export/prompt 不显示为 controlled execution。
- 中文高风险任务不会错误进入标准 audit runner。

### 14.3 验收标准

| 指标 | 要求 |
|---|---|
| 无隐私预览的模型调用 | 0 |
| 读取 L5 敏感文件内容 | 0 |
| 未确认发送完整代码 | 0 |
| 未确认项目写入 | 0 |
| 无 stop_condition 的 spec | 0 |
| 高风险任务错误进入只读执行 | 0 |
| 只读报告缺失 coverage / blind_spots | 0 |

---

## 15. 后续受控执行方案预留

v1 可以增加：

- Claude Code hooks adapter。
- Codex sandbox / approval adapter。
- Git worktree 隔离。
- patch apply 前人工确认。
- scheduled readonly runner。
- event-driven diff watcher。

但这些必须建立在能力检测和强制拦截验证之上，否则只能作为 export/prompt。

---

## 16. 收敛后的技术定义

**LoopPilot MVP 是一个本地 CLI，负责本地扫描、隐私预览、loop 决策、spec 生成和只读巡检报告。它不直接控制 Claude Code / Codex 的写操作；对外部 agent 的集成第一版只提供 export/prompt。真正受控执行放到 v1，并以可验证的 sandbox / approval / hooks 为前提。**
