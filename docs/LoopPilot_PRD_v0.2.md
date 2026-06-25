# LoopPilot PRD v0.2：让小白知道什么时候该 Loop

**版本**：v0.2  
**日期**：2026-06-25  
**工作名**：LoopPilot / Should I Loop  
**一句话定位**：用户不用理解 loop engineering，只要描述想让 AI 做什么，LoopPilot 判断这个任务是否适合 loop；适合则生成安全、可解释、可复制执行的 loop spec；MVP 仅对只读巡检提供真实执行，写操作全部停留在 dry-run 或人工确认。

---

## 1. 背景

AI Coding 工具已经具备多轮修改、测试、审查和执行能力，但 vibe coding 用户的核心问题不是“没有 agent”，而是：

- 不知道什么任务适合 loop，什么任务不该 loop。
- 不知道什么时候一轮对话就够，什么时候需要短 loop。
- 不知道如何设置停止条件、验收条件、预算边界和人工确认。
- 不知道如何避免 AI 无限运行、乱改代码、烧 token、产生不可控变更。
- 看不懂 hook、verifier、gate、runner、skill、state 等工程概念。

LoopPilot 不重造 Claude Code、Codex 或 Cursor，而是在它们之前做一层产品化判断：**先判断要不要 loop，再生成安全 spec，最后选择 export、只读执行或未来受控执行路径。**

---

## 2. 核心问题

用户真正的问题不是：

> 我如何写一个 loop.yaml？

而是：

> 我现在这个任务到底该不该让 AI 自动循环？如果该，怎么安全地开始？如果不该，应该降级成什么？

所以 LoopPilot 的第一性不是“执行 loop”，而是：

1. 识别任务是否适合 loop。
2. 给出普通人能理解的判断理由。
3. 把危险任务自动降级。
4. 生成可检查、可复制、可停止的 loop spec。
5. 在没有强制安全边界时，绝不把 prompt/export 包装成“受控执行”。

---

## 3. 产品目标

### 3.1 北极星目标

**让不会 loop engineering 的用户，也能判断一个任务是否应该自动化循环，并在安全边界内使用它。**

### 3.2 MVP 目标

MVP 只验证一个核心假设：

> 用户是否需要一个“帮我判断该不该 loop”的工具。

MVP 需要做到：

1. 用户输入自然语言任务。
2. LoopPilot 扫描本地项目的低风险元信息。
3. 判断任务属于 `NO_LOOP`、`MANUAL_READONLY_AUDIT`、`SHORT_LOOP_DRY_RUN` 三类主决策之一；对高风险但可做元信息分析的任务，给出 `NO_LOOP_WITH_READONLY_BRIEF` 降级状态。
4. 给出人话解释：为什么适合 / 不适合。
5. 生成 loop spec、运行说明和报告模板。
6. 对 `MANUAL_READONLY_AUDIT` 提供只读真实执行。
7. 对涉及写操作的任务只生成 dry-run 计划、change plan 或 patch outline，不自动写入项目；只有用户显式开启 `--include-code` 后，才允许生成具体 patch proposal。
8. 明确告诉用户哪些内容会发给模型，默认脱敏，用户可选择 opt-in。

### 3.3 v1 目标

在 MVP 验证成立后，再支持：

- 定时触发。
- diff 事件触发。
- Claude Code hooks / Codex approval / sandbox 等受控执行路径。
- 编辑器插件或桌面壳，让更小白的用户不用命令行。

### 3.4 v2 目标

扩展到非 coding 场景：

- PRD 完整性检查。
- Issue / 需求池 triage。
- 用户反馈归因。
- 竞品变化监控。
- 实验复盘。

---

## 4. 用户定位

### 4.1 MVP 核心用户：半熟练开发者 / 早期 adopter

MVP 是 CLI + 本地 Git 仓库形态，因此真实目标用户不是完全小白，而是：

- 会打开终端。
- 会进入一个本地代码仓库。
- 正在使用或尝试 Claude Code / Codex / Cursor。
- 不熟悉 loop engineering，但愿意尝试 AI 自动化。
- 害怕 AI 乱改代码，希望先获得安全建议。

典型需求：

- “这个任务要不要让 AI 一直跑？”
- “我想让 AI 检查项目有没有明显问题，但不要改代码。”
- “我想让 AI 帮我修测试，但别直接乱改。”

### 4.2 长期核心用户：vibe coding 小白

长期目标用户更小白：

- 会用 AI 生成代码，但不懂 Git、测试、CI、hook、agent 配置。
- 想让 AI 多干活，但不知道如何控制风险。
- 对 loop engineering 有兴趣，但不理解概念。

这类用户需要桌面壳、编辑器插件或 Web UI。**不作为 CLI MVP 的首批用户承诺。**

### 4.3 延展用户：AI PM / 团队负责人

- 想把需求检查、Issue triage、文档巡检等重复工作变成可控 loop。
- 关心权限、审计、成本和团队协作。

---

## 5. MVP 范围

### 5.1 MVP 产品形态

MVP 采用 **本地 CLI + 文件产物**。

建议命令：

```bash
looppilot ask "我想让 AI 每天检查这个项目有没有明显问题"
looppilot scan
looppilot recommend
looppilot create
looppilot run --readonly
```

### 5.2 MVP 支持环境

- 本地 Git 仓库。
- Node / Python / Go / Java 等常见项目的基础识别。
- 可选配置用户已有 LLM CLI/API。
- 不接 GitHub App、CI、Slack、飞书、Jira、Notion。

### 5.3 MVP 决策类型

| 类型 | 说明 | MVP 行为 |
|---|---|---|
| `NO_LOOP` | 不适合 loop | 不执行，给单次 prompt 或拆分建议 |
| `NO_LOOP_WITH_READONLY_BRIEF` | 不适合 loop，但可做元信息级风险摘要 | 不进入标准 audit runner，只输出基于目录、配置、diff 摘要的只读 brief |
| `MANUAL_READONLY_AUDIT` | 适合手动触发的只读巡检 | 可真实执行，只读扫描并生成报告 |
| `SHORT_LOOP_DRY_RUN` | 适合短 loop，但涉及写操作或不确定风险 | 只生成 dry-run 计划、change plan、patch outline 或人工执行说明，不自动写 |

### 5.4 MVP 明确不做

- 不做真正 scheduled loop。
- 不做 event-driven loop。
- 不做 context refresh 自动写入。
- 不自动修改业务代码。
- 不自动安装依赖。
- 不自动 git commit / push。
- 不自动部署 / 发布。
- 不把 Claude prompt/export 模式称为受控执行。
- 不承诺 token 硬限制，只做估算提示。

### 5.5 MVP 主线

第一版只做一条主线：

```text
scan → recommend → create --export-only → run --readonly
```

其中：

- `scan`：扫描项目元信息和低风险上下文。
- `recommend`：判断该不该 loop。
- `create --export-only`：生成 loop spec 和外部工具提示词。
- `run --readonly`：只读执行一次巡检，生成报告。

### 5.6 只读巡检能力边界

`MANUAL_READONLY_AUDIT` 是元信息级只读巡检，不是完整代码审计。

它可以发现：

- 项目结构、配置、测试脚本、CI、依赖声明中的明显风险信号。
- 最近 diff 的文件规模、风险区域和敏感路径候选。
- README / 配置 / 脚本之间的明显不一致。
- 缺少测试脚本、缺少 CI、存在敏感文件候选等工程卫生问题。

它不会发现：

- 需要执行测试或构建后才能暴露的问题。
- 需要读取完整业务代码才能判断的逻辑 bug。
- 需要运行依赖审计、网络请求或外部服务才能确认的漏洞。
- 需要访问 `.env`、密钥、生产配置或完整 diff 才能验证的问题。

因此只读巡检报告必须包含：

- `confidence`：本次结论的置信度。
- `coverage`：本次实际检查了哪些范围。
- `blind_spots`：本次没有检查、不能保证的范围。

---

## 6. 关键用户流程

### 6.1 不适合 loop

用户输入：

```text
帮我自动重构支付模块，直到没有问题。
```

系统输出：

```text
不建议开启 loop。

原因：
- 支付模块风险高。
- “没有问题”不是可客观验证目标。
- 可能涉及鉴权、订单、资金链路。

建议降级为：
1. NO_LOOP_WITH_READONLY_BRIEF：只输出元信息级风险摘要，不进入标准 audit runner。
2. 人工确认改造计划。
3. 拆成单个子任务后再考虑 SHORT_LOOP_DRY_RUN。
```

### 6.2 适合只读巡检

用户输入：

```text
帮我看看这个项目最近有没有明显风险，不要改代码。
```

系统输出：

```text
建议使用 MANUAL_READONLY_AUDIT。

说明：这是元信息级只读巡检，不是完整代码审计。

它会：
- 读取项目结构、README、配置文件、最近 diff。
- 检查测试缺口、危险依赖、敏感文件风险、大范围改动。
- 生成一份报告。

它不会：
- 修改代码。
- 安装依赖。
- 运行测试或构建。
- 读取完整业务代码。
- 执行 git commit / push。
- 访问 .env 或密钥文件内容。

报告会包含：confidence、coverage、blind_spots。

是否运行一次只读巡检？
```

### 6.3 涉及写操作的短 loop

用户输入：

```text
帮我修复这个失败测试，直到测试通过。
```

系统输出：

```text
建议使用 SHORT_LOOP_DRY_RUN。

原因：目标相对明确，有测试作为验证条件，但涉及写代码，所以 MVP 不会自动修改文件。

我会生成：
- 修复计划。
- 建议阅读的文件。
- 建议修改点。
- 可复制给 Claude Code / Codex 的 dry-run prompt。
- change plan 或 patch outline。
- 人工确认后再执行的步骤。

如果你使用 --include-code 明确允许读取必要代码片段，我才会生成更具体的 patch proposal。
```

---

## 7. 安全承诺

### 7.1 MVP 安全边界

LoopPilot MVP 的安全承诺必须和执行方式匹配。

| 执行方式 | 是否受控执行 | MVP 说明 |
|---|---|---|
| Export / Prompt | 否 | 只生成给 Claude Code / Codex 的提示词或 run.md，不承诺强制拦截 |
| Internal Read-only Run | 是，受 LoopPilot 自身限制 | 仅扫描和生成报告，不写项目文件 |
| Controlled Execution | v1+ | 只有接入外部工具的 sandbox / approval / hooks 并验证有效后，才可称为受控执行 |

### 7.2 默认风险策略

| 风险行为 | MVP 策略 |
|---|---|
| 删除文件 | 阻止，不生成自动执行步骤 |
| 修改 .env / secrets | 阻止，不读取内容 |
| 安装依赖 | 不执行，只提示人工确认 |
| 修改 auth / payment / permission 模块 | 降级为 `NO_LOOP_WITH_READONLY_BRIEF`，只输出元信息级风险摘要 |
| 写业务代码 | dry-run，不自动写入 |
| git commit | 不执行 |
| git push | 不执行 |
| 部署 / 发布 | 不执行 |
| 外部网络请求 | 默认不执行 |

### 7.3 预算控制

MVP 能强制的限制：

- 最大运行时间。
- 最大扫描文件数。
- 最大 diff 行数。
- 最大输出报告大小。
- 最大 loop 轮次，MVP 默认 1 轮。

MVP 只能估算的限制：

- token 消耗。
- 外部 CLI / 订阅模型真实成本。

因此文案必须写成：

> 预计 token 消耗：xx。LoopPilot 无法强制限制外部 CLI 的真实 token 消耗，除非该执行路径明确支持预算拦截。

---

## 8. 隐私和代码外发策略

### 8.1 默认原则

LoopPilot 是“小白安全工具”，所以默认必须保守：

1. 默认本地扫描。
2. 默认只发送摘要，不发送完整代码。
3. 默认脱敏。
4. 默认不读取 `.env`、密钥、证书、私钥、token 文件内容。
5. 发送给模型前必须展示摘要清单。
6. 用户显式 opt-in 后，才允许发送更多上下文。

### 8.2 扫描内容分级

| 级别 | 内容 | 默认是否可发送给模型 |
|---|---|---|
| L0 元信息 | 语言、框架、文件数量、目录结构摘要 | 可发送 |
| L1 配置摘要 | package.json 依赖名、测试命令候选、CI 类型 | 可发送，但脱敏 |
| L2 文档摘要 | README 摘要、注释摘要 | 可发送摘要，不默认发送全文 |
| L3 diff 摘要 | 最近 diff 的文件名、变更规模、风险分类 | 可发送摘要，不默认发送完整 diff |
| L4 代码片段 | 具体代码内容 | 默认不发送，需要 opt-in |
| L5 敏感内容 | .env、secrets、证书、私钥、token、生产配置 | 永不发送，默认不读取 |

### 8.3 用户可见提示

运行前必须展示：

```text
本次将发送给模型的内容：
- 项目类型：Node.js / TypeScript
- 目录结构摘要：已脱敏
- 依赖摘要：仅包名和版本
- 最近 diff 摘要：仅文件名和变更行数

不会发送：
- .env 内容
- 密钥文件
- 完整源代码
- 完整 diff

如需让模型读取具体代码片段，请使用 --include-code 明确开启。
```

### 8.4 模型调用确认模式

MVP 提供三种隐私确认模式：

| 模式 | 行为 | 适用场景 |
|---|---|---|
| `local-only` | 只使用本地规则和扫描摘要，不调用模型 | 用户未配置模型、或不希望任何内容外发 |
| `interactive` | 生成 `privacy-preview.md`，用户确认后才发送摘要 | 默认模式 |
| `--send-summary` | 命令行显式允许发送 L0-L3 摘要 | 自动化脚本或熟练用户 |

`--include-code` 是单独的高风险开关，只允许发送必要 L4 代码片段或完整 diff 片段；即使开启，也仍然禁止读取或发送 L5 敏感内容。

---

## 9. Loop Spec 产物

MVP 生成以下文件：

```text
.looppilot/
  project-scan.json
  privacy-preview.md
  recommendations.md
  loops/
    <loop-name>/
      loop.yaml
      run.md
      report-template.md
  runs/
    <run-id>/
      report.md
      log.jsonl
```

`loop.yaml` 必须包含：

- goal
- decision_type
- mode
- context_policy
- allowed_actions
- forbidden_actions
- verification
- stop_condition
- budget_estimate
- privacy_policy
- execution_mode
- user_confirmation

---

## 10. 成功指标

### 10.1 MVP 产品指标

| 指标 | 目标 |
|---|---|
| 用户理解度 | 用户能复述“它会做什么 / 不会做什么” |
| 推荐接受率 | > 40% |
| 危险任务降级 / 拒绝准确率 | > 90% |
| 只读巡检成功生成报告率 | > 70% |
| 用户愿意复制 spec 给 Claude/Codex 的比例 | > 30% |

### 10.2 MVP 质量指标

| 指标 | 目标 |
|---|---|
| 无停止条件的 spec | 0 |
| 无隐私预览的模型调用 | 0 |
| 未经确认发送完整代码 | 0 |
| 未经确认的项目文件写入 | 0 |
| 把 export/prompt 模式误称为受控执行 | 0 |
| 读取 L5 敏感文件内容 | 0 |
| 只读巡检报告缺失 coverage / blind_spots | 0 |

---

## 11. 产品路线

### v0.1：判断和只读巡检

- CLI。
- scan / recommend / create / run --readonly。
- 三类主决策：NO_LOOP、MANUAL_READONLY_AUDIT、SHORT_LOOP_DRY_RUN；以及高风险降级状态 NO_LOOP_WITH_READONLY_BRIEF。
- 默认隐私预览。
- 只读真实执行。

### v0.2：更好的 export 体验

- Claude Code run.md。
- Codex prompt.md。
- change plan / patch outline 模板。
- 更细的风险解释。

### v1：受控执行

只有满足以下条件才进入 v1：

- 外部工具能力可检测。
- sandbox / approval / hooks 能被程序化验证。
- LoopPilot 能确认写操作被拦截或需要人工确认。

v1 才支持：

- 真正 SHORT_LOOP。
- 定时只读巡检。
- diff 事件触发。
- hooks / approval 集成。

### v2：小白入口

- 桌面壳。
- 编辑器插件。
- “Loop this” 按钮。
- 非 coding 场景。

---

## 12. 收敛后的 MVP 定义

**LoopPilot MVP 是一个本地 CLI，帮助用户判断任务是否适合 loop，并生成安全、可解释、可复制执行的 loop spec；MVP 只支持只读巡检的真实执行，写操作全部停留在 dry-run / 人工确认。**

第一版不追求“自动把事情做完”，只验证：

> 用户是否真的需要一个帮他判断“要不要 loop”的产品。
