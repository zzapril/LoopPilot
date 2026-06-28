# LoopPilot PRD v0.2：Agent-native Loop Check

**版本**：v0.2 rewrite
**日期**：2026-06-25  
**工作名**：LoopPilot / Should I Loop  
**一句话定位**：LoopPilot 是 Codex 和 Claude Code 里的 loop-check 和 loop contract 能力。用户不用懂 loop engineering，只要说想让 AI 做什么，LoopPilot 先判断该不该 loop；适合则生成安全边界、停止条件和验收标准，并让当前 agent 直接按 contract 执行。

---

## 1. 背景

Codex、Claude Code 等 agent 已经能读代码、改代码、跑测试、总结结果。LoopPilot 不需要再做一个 runner，也不需要再接一个 AI provider。

真正的问题是：普通用户不知道什么时候该让 agent 循环工作，也不知道怎么给 loop 设置边界。

用户卡住的不是：

> 我怎么写一个 loop runner？

用户真正问的是：

> 这个任务该不该让 Codex / Claude Code 循环做？如果可以，怎么保证它不会乱跑？

LoopPilot 的目标是站在 agent 执行之前，做一次轻量的资格审查和任务包装。

---

## 2. 产品定位

LoopPilot 不是：

- 不是新的 coding agent。
- 不是新的 agent runtime。
- 不是 GitHub issue bot。
- 不是自动扫描或自动执行 GitHub issue 的 queue。
- 不是 scheduled loop 平台。
- 不是自动部署、自动合并、自动发布工具。
- 不替代 Codex / Claude Code / Cursor。

LoopPilot 是：

- loop qualification：判断任务值不值得 loop。
- loop contract：把目标、边界、验收、停止条件写清楚。
- agent-native handoff：让当前 Codex 或 Claude Code session 直接执行。
- single issue intake：用户显式贴一个 GitHub issue URL 时，只读读取该 issue 并交给当前 agent 判断。
- export fallback：必要时导出给 GitHub issue 或其他 agent。

一句话：

> LoopPilot 负责“该不该 loop、怎么安全 loop”；Codex / Claude Code 负责真正执行。

### 2.1 和 Copilot / OpenHands / SWE-agent 的区别

LoopPilot 处在 coding agent 之前，不是一个新的自动修 issue agent。

| 类型 | 典型行为 | LoopPilot 的边界 |
|---|---|---|
| GitHub Copilot coding agent | 把 issue/task 交给 cloud agent，由 agent 研究仓库、改代码、开 PR | LoopPilot 不创建 branch、commit、PR，也不写 GitHub comment |
| OpenHands-style issue resolver | 通过 label/comment/web workspace 触发 agent 处理 issue | LoopPilot 不监听 label，不扫描 issue queue，不做后台 resolver |
| SWE-agent-style autonomous issue fixer | 针对 GitHub issue 跑 agent loop，并保留 trajectory / result 供检查 | LoopPilot 只给当前 Codex / Claude Code session 提供 decision 和 contract |

这些项目值得借鉴的是：

- 更清晰的 issue intake。
- 可审计的执行记录。
- 明确的 stop reason 和 verifier gate。

但 MVP 不借鉴的是：

- 自动领取 issue。
- 自动修改代码。
- 自动创建 PR。
- 自动评论/关闭 issue。
- 自己维护 agent runner 或 provider。

因此，LoopPilot 的产品心智应保持为：

> 它不是“帮你自动修 issue 的机器人”，而是“帮当前 agent 判断这个任务该不该进入受控 loop 的安全层”。

### 2.2 进一步收敛：v0 不是 CLI 产品，而是 Agent Pack

v0 最容易走偏的点是：把 LoopPilot 做成一个新的 CLI 或平台。那会重新发明 agent runner，也会让 Codex / Claude Code 支持变成“导出文件再复制”的二等体验。

更简单的 MVP 形态应该是：

- 一个共享的 LoopPilot core：规则、decision schema、contract 模板、测试样例。
- 一个 Codex wrapper：以 Codex skill / session 指令方式触发。
- 一个 Claude Code wrapper：以 Claude Code skill 方式触发，slash command 只做快捷别名。
- 一个可选的 repo scan 小脚本：只生成证据摘要，不参与执行 loop。

用户体验上，用户仍然只在当前 agent 里说：

```text
帮我判断这个任务能不能 loop，然后按安全 contract 执行。
```

LoopPilot 不要求用户复制 prompt，也不要求用户离开 Codex / Claude Code。

v0 第一刀只交付五件事：

- `qualification-rules.md`
- `decision-schema.json`
- `contract-template.md`
- `decision-fixtures.jsonl`
- Codex / Claude Code 两个 wrapper

scan、export、report 文件写入都后置；先把“判断协议”做稳。

---

## 3. GitHub Loop 项目启发

LoopPilot 参考 GitHub 上几个 loop 相关项目的实践，但只取最小有用部分。

| 项目 | 值得复用的点 | LoopPilot 的取舍 |
|---|---|---|
| `breim/loop-harness` | 先做资格门禁；大多数任务不值得 loop；auth/payment/architecture 默认拒绝 | MVP 优先做 loop-check |
| `ksimback/looper` | 先设计 loop，再交给现有 agent；生成 handoff 文件；强调 verification 和 stop guards | MVP 生成 agent loop contract |
| `iannuttall/ralph` | files + git 作为状态；agent runner 可替换为 Codex / Claude | MVP 不做 runner，只借鉴文件化 contract |
| `federiconeri/wiggum-cli` | scan -> spec -> delegate to Claude/Codex | MVP 保留 scan + handoff，不做完整 feature platform |
| `disler/infinite-agentic-loop` | 用 slash command 触发 agent waves | 暂不采用；风险和适用场景偏内容生成 |

核心结论：

> LoopPilot 应该站在 loop-harness / looper 这一层，而不是 ralph / wiggum runner 这一层。

---

## 4. 目标用户

### 4.1 MVP 用户

MVP 用户是在 Codex 或 Claude Code 里工作的开发者或 vibe coding 用户：

- 正在让 Codex / Claude Code 做代码任务。
- 不确定任务是否适合反复执行。
- 害怕 agent 越改越多、碰到危险模块、烧太多时间。
- 希望 agent 先给出一个明确的 loop 判断和执行边界。

典型问题：

- “这个任务能不能让 Codex / Claude Code 一直修到测试过？”
- “帮我检查项目有没有明显风险，但别乱改。”
- “这个需求太大，能不能拆成安全的 loop？”
- “哪些任务不应该交给 agent 自动跑？”

### 4.2 非 MVP 用户

暂不承诺：

- 完全不使用 Codex、Claude Code 或终端的纯小白。
- 需要团队权限、审计、预算平台的企业用户。
- 需要长期定时任务、CI 事件触发、GitHub backlog agent 的团队。

这些可以放到 v1/v2。

---

## 5. MVP 目标

MVP 只验证一个核心假设：

> 用户在 Codex / Claude Code 里是否需要一个“Should I Loop?”能力。

MVP 需要做到：

1. 用户在 Codex 或 Claude Code 中描述任务。
2. LoopPilot 使用用户目标和当前 agent 已有上下文判断；repo scan 只是可选证据补充。
3. LoopPilot 先输出可校验 JSON decision，再输出人话解释。
4. LoopPilot 给出 `RUN_WITH_CONTRACT`、`PLAN_ONLY`、`NO_GO` 三类判断。
5. 如果 `RUN_WITH_CONTRACT`，生成 loop contract，用户确认后当前 agent 直接执行。
6. 如果 `PLAN_ONLY`，当前 agent 只生成计划和风险说明，不改代码。
7. 如果 `NO_GO`，明确拒绝 loop，并给出安全替代方案。
8. 每次判断都说明：为什么、会做什么、不会做什么、什么时候停。
9. 同一任务在 Codex 和 Claude Code 中应得到一致的 decision 和 contract。

MVP 交互约束：

- 最多澄清一次；仍不明确就返回 `PLAN_ONLY`。
- 默认 chat-first，不写 `.looppilot/latest-contract.md`、`.looppilot/latest-report.md`、`.looppilot/latest-review-gate.md`、`.looppilot/VISION.md`、`.looppilot/STATE.md` 或 `.looppilot/RUN_LOG.md`。
- 只有用户明确要求保存时，才写入文件。
- 当前 agent 能力不明时，不能进入 `RUN_WITH_CONTRACT`。

MVP 不做：

- 不做独立 runner。
- 不先做完整 CLI。
- 不做 `run --readonly` 或任何真实后台执行命令。
- 不接独立 AI provider。
- 不实现 scheduled loop。
- 不实现 GitHub issue queue。
- 只允许用户显式指定单个 GitHub issue 的只读 intake，不自动扫 issue。
- 不自动 commit / push / merge / deploy。
- 不做长期状态机。
- 不把 export prompt 包装成受控执行。
- 不默认写文件。

---

## 6. 决策类型

### 6.1 `NO_GO`

不应该 loop。

适用：

- 目标过宽，例如“把项目做完”。
- 没有客观验收标准，例如“直到没问题”。
- 涉及支付、鉴权、权限、生产、数据删除、部署发布。
- 需要架构级改造或高风险业务判断。

行为：

- 当前 agent 不进入循环执行。
- 输出拒绝理由。
- 给出更安全的拆分建议或只读分析建议。

### 6.2 `PLAN_ONLY`

可以让当前 agent 思考，但不应该直接执行。

适用：

- 任务可能适合 loop，但当前信息不足。
- 需要改代码，但风险或范围还没有收敛。
- 用户要求修复/重构，但验收条件还不够明确。

行为：

- 当前 agent 生成计划、风险、建议文件、待确认步骤。
- 不写业务代码。
- 不运行危险命令。
- 用户确认后，可重新进入 `RUN_WITH_CONTRACT` 判断。

### 6.3 `RUN_WITH_CONTRACT`

可以让当前 agent 在明确边界内执行短 loop。

适用：

- 目标明确。
- 有客观验收，例如测试命令、lint、类型检查、报告生成。
- 风险可控。
- 能设置停止条件。

行为：

- 生成 loop contract。
- 用户确认 contract。
- 当前 agent 直接执行。
- 执行结束后输出报告。

### 6.4 澄清规则

LoopPilot 不是需求访谈工具。信息不足时可以问一次澄清问题，但最多一次：

- 如果用户补充后目标、gate、风险仍不清楚，返回 `PLAN_ONLY`。
- 如果任务涉及高风险区域，不能靠澄清问题绕过安全规则。
- 如果当前 agent 能力不明，例如不能确认 approval、sandbox、permission 行为，返回 `PLAN_ONLY`。

---

## 7. Agent-native 用户流程

### 7.1 不适合 loop

用户：

```text
帮我自动重构支付模块，直到没有问题。
```

LoopPilot / current agent：

```text
NO_GO

不建议 loop。

原因：
- 支付模块风险高。
- “没有问题”不是客观验收条件。
- 可能涉及鉴权、订单、资金链路和生产数据。

安全替代：
1. 先做只读风险分析。
2. 让人确认改造边界。
3. 拆成一个有测试保护的小任务后再判断。
```

### 7.2 只做计划

用户：

```text
帮我把这个项目结构整理一下。
```

LoopPilot / current agent：

```text
PLAN_ONLY

这个任务可能有价值，但范围太宽，不建议直接执行。

我会先输出：
- 当前结构观察。
- 风险区域。
- 建议拆分。
- 第一批可安全执行的小任务。

不会修改文件。
```

### 7.3 可以短 loop

用户：

```text
帮我修复当前 failing test，最多试 5 轮。
```

LoopPilot / current agent：

```text
RUN_WITH_CONTRACT

适合短 loop。

Loop contract:
- Goal: 修复当前 failing test。
- Gate: 测试命令通过。
- Max rounds: 5。
- Stop: 测试通过、连续两轮无进展、触发危险文件、用户中断。
- Never do: 不修改 auth/payment/secrets，不安装依赖，不 commit/push。

确认后我将按 contract 执行。
```

---

## 8. Loop Contract

Loop contract 是当前 agent 执行前必须确认的短文档，不是复杂标准。

每次判断必须先输出机器可校验 JSON，再输出人话解释。JSON 至少包含：

```json
{
  "decision": "RUN_WITH_CONTRACT",
  "confidence": "medium",
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

如果 `host_capabilities.capability_confidence` 不是 `known`，默认不能返回 `RUN_WITH_CONTRACT`。

必须包含：

- `decision`: `RUN_WITH_CONTRACT` / `PLAN_ONLY` / `NO_GO`
- `goal`: 本次目标
- `scope`: 允许看的范围
- `allowed_actions`: 允许动作
- `forbidden_actions`: 禁止动作
- `gate`: 验收方式
- `stop_conditions`: 停止条件
- `max_rounds`: 最大轮次
- `host_capabilities`: 当前 agent 能力判断
- `human_confirmations`: 需要人工确认的动作
- `report`: 结束报告格式

MVP 默认直接在 Codex / Claude Code session 中生成并执行。文件只是显式保存选项，不是默认行为：

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
```

Agent wrapper 可以放在：

```text
.agents/skills/looppilot/SKILL.md        # Codex
.claude/skills/looppilot/SKILL.md        # Claude Code
.claude/commands/should-loop.md          # Claude Code 可选兼容入口
```

只有当用户需要跨工具复用时，才导出：

```text
.looppilot/
  exports/
    RUN_IN_CODEX.md
    RUN_IN_CLAUDE.md
    github-issue.md
```

---

## 9. 安全原则

MVP 默认规则：

| 行为 | 默认策略 |
|---|---|
| 删除文件 | `NO_GO` 或强确认 |
| 修改 `.env` / secrets | 禁止 |
| 修改 auth / payment / permission | `NO_GO` 或 `PLAN_ONLY` |
| 安装依赖 | `PLAN_ONLY`，除非用户确认 |
| git commit | 不自动执行 |
| git push | 不自动执行 |
| deploy / publish | 不执行 |
| 无测试保护的大改动 | `PLAN_ONLY` |
| 目标过宽 | `NO_GO` 或拆分 |
| host 能力不明 | `PLAN_ONLY` |
| 用户未要求保存文件 | 不写文件 |

安全判断来自 LoopPilot 的本地规则和 contract，不来自 agent 自我感觉。

---

## 10. MVP 验证方式

v0 不靠“看起来能用”验证，而靠一组固定任务集验证。

必须有：

- 至少 45 个 decision fixture，覆盖 `NO_GO`、`PLAN_ONLY`、`RUN_WITH_CONTRACT`。
- 所有 decision 输出必须通过 `decision-schema.json` 校验。
- 同一 fixture 在 Codex wrapper 和 Claude Code wrapper 中输出同一 decision。
- 每个 `RUN_WITH_CONTRACT` 都必须包含 gate、stop conditions、forbidden actions。
- 每个 `RUN_WITH_CONTRACT` 都必须包含已知 host capability profile。
- 每个高风险 fixture 都必须 fail closed：宁可 `PLAN_ONLY` / `NO_GO`，不能误进 `RUN_WITH_CONTRACT`。
- 每次改规则、改 wrapper，都跑 fixture 回归。

这比先写 CLI 更重要，因为 LoopPilot 的核心价值是“判断正确”，不是“命令漂亮”。

---

## 11. 成功指标

MVP 产品指标：

- 用户能理解为什么是 `RUN_WITH_CONTRACT` / `PLAN_ONLY` / `NO_GO`。
- 用户愿意让 Codex / Claude Code 按 contract 执行 `RUN_WITH_CONTRACT` 任务。
- 危险任务不会进入 `RUN_WITH_CONTRACT`。
- `RUN_WITH_CONTRACT` 任务都有 gate 和 stop conditions。
- 用户觉得 contract 比直接 prompt 更安全、更清楚。
- 同一个任务在 Codex 和 Claude Code 中不会产生明显不同的安全判断。

MVP 质量指标：

- 无 gate 的 `RUN_WITH_CONTRACT`：0。
- 无 stop conditions 的 `RUN_WITH_CONTRACT`：0。
- auth/payment/production 任务误判为 `RUN_WITH_CONTRACT`：0。
- 自动 commit / push / deploy：0。
- 当前 agent 执行前未展示 contract：0。
- JSON decision schema 校验失败：0。
- host 能力不明却进入 `RUN_WITH_CONTRACT`：0。
- 用户未要求保存却写入文件：0。

---

## 12. 路线图

### v0：Agent-native loop-check

- 提供共享 LoopPilot core。
- 提供 `decision-schema.json`。
- 提供 Codex skill wrapper。
- 提供 Claude Code skill wrapper。
- 提供 Claude Code command alias，但只引用 skill，不复制逻辑。
- 提供 45 个 decision fixture。
- 在 Codex / Claude Code 中完成 `RUN_WITH_CONTRACT` / `PLAN_ONLY` / `NO_GO`。
- 生成同一格式的 loop contract。
- 当前 agent 直接按 contract 执行短 loop。
- 默认不写文件；用户要求保存时才写入 `.looppilot/latest-contract.md`、`.looppilot/latest-report.md` 或 `.looppilot/latest-review-gate.md`。

### v0.1：Repo scan helper

- 增加只读 repo scan 小脚本。
- 只输出安全摘要，不直接执行 loop。
- 用 scan summary 辅助 decision fixture 和 contract 生成。

### v0.2：Export fallback

- 生成 `RUN_IN_CODEX.md`。
- 生成 `RUN_IN_CLAUDE.md`。
- 生成 `github-issue.md`。
- 增加 agent-native GitHub issue URL intake：`/should-loop <issue-url>` 或 `Use LoopPilot on <issue-url>`。
- issue intake 只读单个 issue，不读 comments / linked PR / attachments / logs，不自动执行。

### v1：Reusable loop artifacts

- 引入 `VISION.md` / `STATE.md` / `RUN_LOG.md`。
- 支持反复运行的手动 loop。
- 借鉴 loop-harness 的 verifier / review gate。
- 明确 `save-vision`、`save-state`、`save-run-log` 默认写入 `.looppilot/VISION.md`、`.looppilot/STATE.md`、`.looppilot/RUN_LOG.md`，且这些文件不是 runner state。

### v2：Orchestration integration

- 更窄的 GitHub single issue intake 已进入 v0.2 release-ready；GitHub issue queue 仍不做。
- scheduled loop。
- Codex sandbox / approval 检测。
- Claude Code hooks / permission 检测。
- 团队权限和审计。

---

## 13. 收敛后的 MVP 定义

**LoopPilot v0 是一套跨 Codex / Claude Code 的 agent-native LoopPilot Pack：共享规则、decision schema、contract 模板和 fixtures，分别用 Codex skill 与 Claude Code skill 承载。它不做 runner，不接独立 AI provider，不要求用户复制 prompt 给 agent，默认不写文件。它先用可校验 JSON 判断任务该不该 loop，再让当前 agent 按明确 contract 执行。**
