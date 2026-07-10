# LoopPilot v0.2 实现状态检查与后续计划

**日期**：2026-06-26  
**依据文档**：

- `docs/LoopPilot_PRD_v0.2.md`
- `docs/LoopPilot_Technical_Design_v0.2.md`

**检查范围**：当前仓库代码、Agent Pack 文件、验证脚本、fixtures、README 与现有实现进度文档。

---

## 1. 总体结论

当前代码已经完成了 **LoopPilot v0：Agent-native loop-check** 的核心交付形态，并继续补齐了本文档先前列出的主要未完成项：

- 已有共享 core：规则、decision schema、contract template。
- 已有 52 条 decision fixtures，覆盖 `NO_GO`、`PLAN_ONLY`、`RUN_WITH_CONTRACT`，并包含 capability-aware `goal`、`loop`、`routine` 示例。
- 已有 Codex 与 Claude Code wrapper，并且 wrapper 明确引用共享 core，不复制规则。
- 已有 Claude Code command alias。
- 已有 fixture validator、wrapper validator、统一 test 命令。
- 已有一个轻量 CLI/脚本层，支持 `install`、`doctor`、`scan`、`host-capabilities`、`claude-project-summary`、`issue-intake`、显式 `export` 与显式 `save-*`，用于安装/检查 Agent Pack、生成只读证据摘要、读取单个 GitHub issue、导出 handoff 和保存用户明确要求的 artifacts。
- 已有 runtime JSON Schema、Ajv cross-check、schema drift、wrapper parity、golden wrapper parity eval、scan output、scan secret-safety、host/Claude helper、issue-intake、export template、fixture coverage taxonomy、export command、save command、manual template、review-gate template、package contents、docs consistency、CLI args、install/doctor integration 验证。

当前仍需注意的边界：

- Schema 校验当前采用由 Ajv 在构建时生成的独立 validator、生成文件漂移检查和语义 safety validator；运行时不依赖 Ajv 包。
- Export fallback 已提供模板和显式 `looppilot export` 命令，但仍只是 handoff，不是受控执行。
- Scan helper 已实现只读摘要，但不参与自动 decision；它只是给当前 agent 提供可选证据。
- LoopPilot 仍然不做 runner、provider registry、scheduler、GitHub issue queue、自动 commit/push/deploy。

---

## 2. PRD / 技术设计需求对照表

| 需求项 | 文档要求 | 当前状态 | 证据 | 结论 |
|---|---|---:|---|---|
| 共享 core | `.looppilot/core/qualification-rules.md`、`decision-schema.json`、`contract-template.md` | 已完成 | `.looppilot/core/` 已存在 3 个核心文件 | v0 完成 |
| 三类 decision | `NO_GO` / `PLAN_ONLY` / `RUN_WITH_CONTRACT` | 已完成 | schema 与 validator 均包含三类决策 | v0 完成 |
| JSON first | 每次判断先输出可校验 JSON | 已在规则和 wrapper 中要求 | qualification rules、Codex/Claude wrapper 均写明 | v0 完成，需继续用测试约束 |
| Host capability gate | host 能力未知不能 `RUN_WITH_CONTRACT` | 已完成 | core 规则、schema、validator 均检查 `capability_confidence` | v0 完成 |
| Contract template | `RUN_WITH_CONTRACT` 必须显示 contract | 已完成 | contract template 已存在 | v0 完成 |
| 52 fixtures | 至少 45 条，三类各 15 条 | 已完成 | `.looppilot/fixtures/decision-fixtures.jsonl` 有 52 行 | v0 完成 |
| Fixture validator | 校验 schema 与 expected fields | 已完成 | `scripts/validate-fixtures.mjs`、`scripts/validate-schema.mjs` 与 `decision-validator.mjs` | v0 完成 |
| Wrapper parity | Codex 与 Claude Code 同一任务 decision 一致 | 已增强 | `scripts/validate-wrapper-parity.mjs` 检查 workflow 与 guardrails 同构，`npm run eval:wrapper-parity` 校验 golden output safety fields | v0 完成 |
| Codex wrapper | `.agents/skills/looppilot/SKILL.md` | 已完成 | 文件存在并引用 core | v0 完成 |
| Claude wrapper | `.claude/skills/looppilot/SKILL.md` | 已完成 | 文件存在并引用 core | v0 完成 |
| Claude command alias | `.claude/commands/should-loop.md` 只引用 skill | 已完成 | command 文件明确不复制规则 | v0 完成 |
| Chat-first 默认 | 未显式要求保存时不写 latest 文件 | 已在规则/wrapper 中要求 | core 规则与 wrapper 均说明 | v0 完成 |
| 不做 runner/provider | MVP 不实现 runner，不接 provider | 当前符合 | 没有后台 runner / provider registry | v0 完成 |
| Install / doctor | 技术设计未强制，但可作为分发辅助 | 已完成 | `scripts/looppilot.mjs` 支持 install/doctor | 超出 v0，正向补充 |
| Repo scan helper | v0.1：只读 scan summary | 已完成 | `.looppilot/scripts/scan-summary.mjs` 与 `scripts/validate-scan-summary.mjs` | v0.1 完成 |
| GitHub issue URL intake | v0.2：Claude/Codex 当前会话内读取单个 issue 并交给 agent 判断 | 已完成 | `.looppilot/scripts/issue-intake.mjs`、`looppilot issue-intake`、wrapper 更新与 `scripts/validate-issue-intake.mjs` | v0.2 完成 |
| Export fallback | v0.2：生成 Codex/Claude/GitHub issue handoff | 已完成 | `.looppilot/core/export-template-*.md` 与 `looppilot export` | v0.2 完成 |
| Latest/review/manual artifact 保存 | 仅用户明确要求时保存 | 已完成 | `save-contract`、`save-report`、`save-review-gate`、`save-vision`、`save-state`、`save-run-log` 均要求 `--from`，默认 duplicate protection | v1 手工 artifact 策略完成 |
| Safety tests | 覆盖 payment/auth/deploy/secrets/unknown host 等 | 已增强 | `npm test` 覆盖 fixtures、schema、Ajv、wrapper、parity、scan、host/Claude helper、issue-intake、export、coverage、manual templates、review gate、package contents、docs consistency、CLI args、install/doctor | 持续增强 |

---

## 3. 已完成内容详解

### 3.1 共享 LoopPilot core

当前仓库已经具备 PRD v0 第一刀要求的三个核心文件：

```text
.looppilot/core/qualification-rules.md
.looppilot/core/decision-schema.json
.looppilot/core/contract-template.md
```

完成点：

- `qualification-rules.md` 定义了输出顺序、三类 decision、two-condition test、host capability gate、hard defaults、risk keywords、clarification rule、contract invariants 和 file policy。
- `decision-schema.json` 定义了 decision 顶层字段、host capabilities、contract、scope、allowed/forbidden actions、gate、stop conditions、human confirmations、report 等结构。
- `contract-template.md` 给出了 `RUN_WITH_CONTRACT` 的 JSON 示例与人类可读 contract 模板。

评估：

- core 已经可以支撑 Codex / Claude Code wrapper 使用。
- core 符合“Shared core, thin wrappers”原则。
- 需要注意：schema 中目前 `contract` 的 JSON Schema 声明为 `type: ["object", "null"]`，但仍设置了 `required` 与 `properties`。这是合法表达，但后续若接入 Ajv 等 JSON Schema validator，需要补充自动化测试确保 null 分支表现符合预期。

### 3.2 Decision fixtures

当前 `.looppilot/fixtures/decision-fixtures.jsonl` 有 52 行 fixture，满足 PRD 和技术设计要求：

- 15 个 `NO_GO`
- 18 个 `PLAN_ONLY`
- 19 个 `RUN_WITH_CONTRACT`
- 覆盖 `recommended_surface` 的 `manual`、`plan`、`goal`、`loop`、`routine` 示例

完成点：

- 高风险任务如 payment、auth、deploy、production delete 已进入 `NO_GO`。
- 不明确、范围较大、缺 gate 或需要依赖安装的任务可进入 `PLAN_ONLY`。
- 有明确目标、客观 gate、scope、stop conditions、max rounds 的任务进入 `RUN_WITH_CONTRACT`。

评估：

- fixtures 数量与类别分布达标。
- 下一步应把 fixtures 的覆盖范围变成可读报告，例如输出每类风险关键词覆盖情况，避免只是检查数量。

### 3.3 Codex 与 Claude Code wrappers

当前已有：

```text
.agents/skills/looppilot/SKILL.md
.claude/skills/looppilot/SKILL.md
.claude/commands/should-loop.md
```

完成点：

- 两个 skill 都要求先读取 `.looppilot/core/` 下的共享 core。
- 两个 skill 都说明不得复制或重新解释规则，shared core 是 source of truth。
- Codex wrapper 使用 `host: codex`。
- Claude Code wrapper 使用 `host: claude_code`。
- Claude command alias 只指向 Claude skill，不复制 qualification rules。

评估：

- 结构符合技术设计。
- 当前已覆盖两层 parity：`validate-wrapper-parity.mjs` 检查 wrapper workflow/guardrails 同构，`npm run eval:wrapper-parity` 使用 golden wrapper outputs 校验安全关键字段一致。
- 剩余边界是仍不调用真实 Codex/Claude provider 输出；这是 v0/v1 的刻意选择，避免把 LoopPilot 变成 provider registry 或 runner。

### 3.4 验证脚本与 CLI 辅助

当前已有：

```text
scripts/validate-schema.mjs
scripts/validate-schema-ajv.mjs
scripts/validate-fixtures.mjs
scripts/validate-wrappers.mjs
scripts/validate-wrapper-parity.mjs
scripts/eval-wrapper-parity.mjs
scripts/validate-scan-summary.mjs
scripts/validate-scan-security.mjs
scripts/validate-host-capability-summary.mjs
scripts/validate-claude-project-summary.mjs
scripts/validate-issue-intake.mjs
scripts/validate-exports.mjs
scripts/report-fixture-coverage.mjs
scripts/validate-export-command.mjs
scripts/validate-save-commands.mjs
scripts/validate-manual-templates.mjs
scripts/validate-review-gate-template.mjs
scripts/validate-package-contents.mjs
scripts/validate-docs-consistency.mjs
scripts/validate-cli-args.mjs
scripts/validate-install-command.mjs
scripts/validate-all.mjs
scripts/lib/decision-validator.mjs
scripts/lib/schema-validator.mjs
scripts/lib/wrapper-validator.mjs
scripts/looppilot.mjs
```

完成点：

- `npm test` 会顺序运行 schema、Ajv cross-check、fixture、wrapper、wrapper parity、scan summary、安全 scan、host/Claude helper、export template、fixture coverage、export command、save command、manual template、review-gate template、package contents、docs consistency、CLI args 和 install/doctor validation。
- `validate-fixtures.mjs` 检查至少 45 fixtures、三类各至少 15 条、decision 字段、安全 contract 不变量。
- `validate-schema.mjs` 检查 schema drift，并使用本地 runtime JSON Schema evaluator 对 fixture decisions 做 schema-compatible validation。
- `validate-wrappers.mjs` 检查 wrappers 是否引用 core、是否有正确 host profile、是否要求 JSON first。
- `validate-wrapper-parity.mjs` 检查 Codex / Claude wrapper workflow 和 guardrails 是否同构。
- `validate-scan-summary.mjs` 与 `validate-scan-security.mjs` 分别检查 scan JSON shape 和敏感路径只报告不泄露内容。
- `validate-exports.mjs` 检查 export/report 模板安全声明。
- `validate-issue-intake.mjs` 使用 mock GitHub API 检查单 issue 读取、token header、PR rejection、错误提示、redaction、truncation、`possibly_incomplete` 和不调用 heavy endpoints。
- `report-fixture-coverage.mjs` 统计 decision 分布、风险关键词覆盖、细分 taxonomy 覆盖，并防止高风险 fixture 进入 `RUN_WITH_CONTRACT`。
- `validate-export-command.mjs` 检查全部 export targets 的 dry-run、显式 output、duplicate protection 和 `--force`。
- `validate-save-commands.mjs` 检查 `save-contract` / `save-report` / `save-review-gate` / `save-vision` / `save-state` / `save-run-log` 必须显式 `--from`，默认路径正确，duplicate 需 `--force`，`--dry-run` 不写文件。
- `validate-manual-templates.mjs` 检查 v1 `VISION.md`、`STATE.md`、`RUN_LOG.md` 模板包含 schema/version/scope/gate/review/next-step 等必需字段。
- `validate-review-gate-template.mjs` 检查 review-gate 模板仍是显式 evidence artifact，不是 approval/deploy/release gate。
- `validate-package-contents.mjs` 检查 packed package contents 包含 core/templates/helpers/docs/progress notes，且不包含 `.looppilot/exports/`、`.looppilot/latest-*` 或生成的 v1 artifacts；随后本地安装 packed tarball，并 smoke test `looppilot --help`、`doctor --json`、`install --dry-run` 和 bin shim。
- `validate-docs-consistency.mjs` 检查 README 与全部 `docs/*.md` 不回退到旧小写 artifact、旧 Ajv/parity 说法或未实现的 `looppilot check` 示例。
- `validate-install-command.mjs` 在临时项目中验证 install 后 doctor --json 可通过，并确认 project-root `--cwd` 不会把不存在的目录当成有效项目。
- `looppilot.mjs` 支持 `install`、增强 `doctor`、`scan`、`host-capabilities`、`claude-project-summary`、`issue-intake`、显式 `export` 和显式 `save-*`。

评估：

- 虽然 PRD 强调 v0 不是 CLI-first 产品，但当前 CLI 没有实现 runner，也没有 `run` 命令，因此没有违背“不做 runner”的原则。
- 当前 CLI 是安装和检查工具，属于可接受的分发辅助。

---

## 4. 已补齐项与剩余边界

### 4.1 Schema 验证

已新增：

- `scripts/lib/schema-validator.mjs`：检查 decision schema 与本地安全 validator 的 required fields、enum、contract required fields 是否漂移。
- `scripts/validate-schema.mjs`：对 52 条 fixtures 的 `expected_decision` 做 schema-compatible validation。
- `scripts/validate-schema-ajv.mjs`：用 Ajv 对 fixtures 做交叉校验，避免本地 evaluator 与标准 JSON Schema 行为长期漂移。
- `npm test` 已纳入 schema validation。

剩余边界：

- Ajv 只是 schema-compatible cross-check，不替代 LoopPilot 安全 validator；`RUN_WITH_CONTRACT` 的 gate、scope、forbidden actions、host capability 等安全不变量仍由 `decision-validator.mjs` 明确检查。

### 4.2 Wrapper parity

已新增：

- `scripts/validate-wrapper-parity.mjs`：检查 Codex / Claude wrapper 的 core refs、workflow steps、guardrails 是否同构。
- `scripts/eval-wrapper-parity.mjs`：读取 golden wrapper outputs，并比较 safety-critical normalized fields。
- Claude command alias 增加禁止复制核心规则内容的检查。
- `npm test` 已纳入 wrapper parity validation。

剩余边界：

- 该校验不调用真实模型 provider，也不模拟长期执行。MVP 仍坚持 no provider / no runner，因此 golden parity 是当前阶段可控的 release gate。

### 4.3 Repo scan helper

已新增：

- `.looppilot/scripts/scan-summary.mjs`：输出只读 repo evidence summary。
- `scripts/validate-scan-summary.mjs`：检查 scan 输出 JSON shape，并防止输出明显 secret 内容。
- `looppilot scan`：显式运行只读 scan。

scan helper 输出：

- `repo.dirty`
- `repo.changed_files`
- `repo.diff_stat`
- `repo.readme_title`
- `project.languages`
- `project.test_commands`
- `project.build_commands`
- `risk.risk_paths`
- `risk.sensitive_candidates`

安全边界：

- scan helper 不执行 loop。
- scan helper 不读取 `.env`、`.env.*`、`*.pem`、`*.key`、`secrets/**`、`.ssh/**`、`.aws/**` 的内容。
- scan 结果只是可选证据，不能让未知 host capability 自动进入 `RUN_WITH_CONTRACT`。

### 4.4 GitHub issue URL intake

已新增：

- `.looppilot/scripts/issue-intake.mjs`
- `looppilot issue-intake --url <github-issue-url>`
- `looppilot issue-intake --repo owner/name --number <issue-number>`
- Claude `/should-loop <issue-url>` wrapper flow
- Codex `Use LoopPilot on <issue-url>` wrapper flow
- `scripts/validate-issue-intake.mjs`

安全边界：

- issue intake 是当前 agent 会话里的输入来源，不是独立 runner。
- helper 只读取单个 GitHub issue endpoint：title、body、labels、state、author、timestamps、URL 和 comments count。
- helper 不读 comments、linked pull requests、attachments、logs、timeline，也不扫描 issue 列表。
- helper 不总结、不分类、不生成最终 contract；最终 `NO_GO` / `PLAN_ONLY` / `RUN_WITH_CONTRACT` 仍由 Codex / Claude Code 当前会话使用 shared core 判断。
- issue body 被视为不可信输入；helper 会做明显 token/secret redaction，并在有评论、URL 指向评论、body 被截断或 issue 文本引用外部上下文时标记 `possibly_incomplete`。
- helper 不写 GitHub，不 comment、不 close issue、不创建 branch/PR、不 push/deploy。

### 4.5 Export fallback

已新增：

- `.looppilot/core/export-template-codex.md`
- `.looppilot/core/export-template-claude.md`
- `.looppilot/core/export-template-github-issue.md`
- `scripts/validate-exports.mjs`
- `looppilot export --target codex|claude|github-issue`

安全边界：

- export 必须显式触发，默认不会创建 `.looppilot/exports/`。
- export 文件明确说明它只是 handoff，不是 controlled execution。
- 接收 agent 必须重新读取 shared core、输出 schema-valid JSON、展示 contract，并遵守 no commit/push/deploy 等规则。

### 4.6 Report template

已新增：

- `.looppilot/core/report-template.md`

安全边界：

- report template 只用于 chat report 或用户明确要求保存的 report。
- Agent Pack 默认只在聊天中输出 contract/report/review 信息；`.looppilot/latest-contract.md`、`.looppilot/latest-report.md`、`.looppilot/latest-review-gate.md`、`.looppilot/VISION.md`、`.looppilot/STATE.md` 和 `.looppilot/RUN_LOG.md` 只能由用户明确请求或 save 命令写入。

---

## 5. 已实施路线与后续建议

### Phase 0：整理当前 v0 状态（已完成）

目标：让仓库状态与 PRD/TDD 对齐，消除表述和测试边界不清的问题。

任务：

1. 更新 `IMPLEMENTATION_PROGRESS.md`：
   - 将 “Final verification and push” 改为 “Final local verification passed”。
   - 增加 v0.1 / v0.2 pending 列表。
2. 更新 README：
   - 增加 “Current implementation status”。
   - 明确 `looppilot.mjs` 只有 `install` / `doctor`，不是 runner。
3. 将本文档作为实现状态基线，后续每个 phase 完成后更新。

验收：

- `npm test` 通过。
- README 与 progress 文档不再暗示已经实现 scan/export。

### Phase 1：强化 schema 与安全验证（已完成，本地 runtime JSON Schema evaluator）

目标：让“schema-valid JSON”从文档要求变成真实测试门禁。

任务：

1. 引入 JSON Schema validator：
   - 已实现本地 runtime JSON Schema evaluator。
   - 新增 `scripts/validate-schema.mjs`。
2. 修改 `validate-fixtures.mjs`：
   - 先用 `.looppilot/core/decision-schema.json` 校验 `expected_decision`。
   - 再调用 `decision-validator.mjs` 做安全不变量校验。
3. 增加 schema drift 测试：
   - 手写 validator 的 allowed enum 必须与 schema enum 一致。
   - contract required fields 必须一致。
4. 增加负例测试：
   - `RUN_WITH_CONTRACT` 缺 gate 应失败。
   - unknown host capability 进入 `RUN_WITH_CONTRACT` 应失败。
   - contract 缺 forbidden actions 应失败。

验收：

- `npm test` 通过。
- 修改 schema 或 validator 任何一边导致漂移时测试能失败。

### Phase 2：增强 wrapper parity（已完成）

目标：满足技术设计中的 wrapper parity release gate。

任务：

1. 新增 `scripts/validate-wrapper-parity.mjs`。
2. Wrapper parity 检查：
   - Codex 与 Claude wrapper 必须引用同一 core 文件列表。
   - workflow 步骤数量和关键短语一致。
   - guardrails 关键规则一致。
   - 允许差异仅限 host profile、host 名称、执行会话名称。
3. 将 parity validator 纳入 `validate-all.mjs`。
4. 为 Claude command alias 增加更严格检查：
   - 必须引用 skill。
   - 不得包含风险关键词规则表或 decision schema 复制片段。

验收：

- `npm test` 通过。
- 人为删掉任一 wrapper 的关键 guardrail 时测试失败。

### Phase 3：实现 v0.1 Repo scan helper（已完成）

目标：提供只读、安全、可选的 repo evidence summary。

建议文件：

```text
.looppilot/scripts/scan-summary.mjs
scripts/validate-scan-summary.mjs
```

功能：

1. 读取：
   - `git status --short`
   - `git diff --stat`
   - 根目录 package/project 文件：`package.json`、`pyproject.toml`、`go.mod`、`pom.xml` 等
   - README 标题
   - 候选 test/build commands
   - 风险路径名
2. 不读取内容：
   - `.env`
   - `.env.*`
   - `*.pem`
   - `*.key`
   - `secrets/**`
   - `.ssh/**`
   - `.aws/**`
3. 输出 JSON：

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

验收：

- scan helper 无写文件副作用。
- scan helper 不输出 secret 文件内容。
- scan helper 失败时返回非零并给出安全错误，不影响 core decision 流程。

### Phase 4：实现 v0.2 Export fallback（已完成）

目标：支持用户明确要求时导出 handoff，而不是默认写文件。

建议文件：

```text
.looppilot/core/export-template-codex.md
.looppilot/core/export-template-claude.md
.looppilot/core/export-template-github-issue.md
scripts/export-handoff.mjs
scripts/validate-exports.mjs
```

功能：

1. `looppilot export --target codex --output .looppilot/exports/RUN_IN_CODEX.md`
2. `looppilot export --target claude --output .looppilot/exports/RUN_IN_CLAUDE.md`
3. `looppilot export --target github-issue --output .looppilot/exports/github-issue.md`
4. export 内容必须说明：
   - 这是 handoff，不是受控执行。
   - 接收 agent 必须重新输出 JSON decision。
   - `RUN_WITH_CONTRACT` 必须重新展示 contract。
   - 不得自动 commit / push / deploy。

验收：

- 默认 `install` / `doctor` 不创建 `.looppilot/exports/`。
- 只有用户显式调用 export 才写文件。
- export validator 检查安全免责声明与 core refs。

### Phase 5：报告、review gate 与 v1 手工 artifact 保存（已完成）

目标：补齐 latest contract/report/review-gate 与 v1 手工 artifact 的显式保存路径，但保持 chat-first 默认。

任务：

1. 增加 `.looppilot/core/report-template.md`。
2. 增加 `.looppilot/core/review-gate-template.md`、`vision-template.md`、`state-template.md`、`run-log-template.md`。
3. 增加文档说明：只有用户明确要求保存时，agent 才写：
   - `.looppilot/latest-contract.md`
   - `.looppilot/latest-report.md`
   - `.looppilot/latest-review-gate.md`
   - `.looppilot/VISION.md`
   - `.looppilot/STATE.md`
   - `.looppilot/RUN_LOG.md`
4. 增加 validator 检查：wrapper 不得说默认保存，manual templates 必须包含 schema/version/scope/gate/review/next-step 等必需字段。

验收：

- 默认测试流程不产生 latest 文件。
- report template 包含：what_changed、commands_run、gate_result、risks_or_blockers、next_steps。
- v1 artifacts 是手工持久化文档，不是 runner state，不会默认创建或自动恢复执行。

### Phase 6：发布前质量门禁（已完成基础门禁）

目标：建立每次发版前必须跑的检查列表。

建议命令：

```bash
npm test
node scripts/looppilot.mjs doctor --target both
node scripts/looppilot.mjs install --target both --scope project --dry-run
```

质量门禁：

- fixtures 至少 45 条，且随版本明确增加。
- 三类 decision 分布符合当前版本约定。
- `RUN_WITH_CONTRACT` 无缺 gate、stop conditions、known host capabilities 的情况。
- wrapper parity 通过。
- scan helper 不读 secret 内容。
- export 只能显式生成。

---

## 6. 后续推荐优先级

### P0：保持当前安全门禁稳定

1. 每次修改 core、wrapper、fixtures、scan、export 或 save 命令时必须运行 `npm test`。
2. 保持 wrapper 不复制 core 规则，所有安全策略继续以 `.looppilot/core/` 为 source of truth。
3. 保持 export / latest report / latest contract 显式触发，不改成默认写文件。

### P1：发布前可选增强

1. 继续维护 Ajv 与本地 runtime JSON Schema evaluator 的交叉校验。
2. 可继续扩展 fixture taxonomy，例如为每个 taxonomy 设置最低样例数。
3. 可进一步把 doctor 输出扩展为 JSON report，方便 CI 机器读取。

### P2：后续可审计性增强

1. 设计 `trajectory-lite` artifact，但不要在 `0.2.0` 中实现为默认输出。
2. 只记录用户可见事实：输入、读取的上下文、`possibly_incomplete` warning、decision、建议 gate、用户确认、命令/验证结果摘要。
3. 明确禁止记录隐藏 chain-of-thought、secret、token、环境变量值或原始长日志。
4. 保持显式保存策略：除非用户要求保存，否则不写 `.looppilot/` artifact。

判断：trajectory-lite 值得做，但它不是当前 release-ready 的阻塞项。它更适合作为 issue-intake 稳定后的审计增强，而不是现在扩成 runner 日志。

### 暂不建议做

1. `looppilot run` 或任何后台 runner。
2. 接入 OpenAI/Anthropic provider registry。
3. GitHub issue queue、scheduler、长期状态机；单个 issue 的只读 intake 已完成，不应扩展成自动队列。
4. 自动 commit / push / deploy。

原因：这些都被 PRD/TDD 明确排除在 MVP 之外，会把产品从 agent-native loop-check 拉偏成 runner/orchestrator。

---

## 7. 建议的 Definition of Done

### v0 DoD

- [x] 共享 core 存在。
- [x] decision schema 存在。
- [x] contract template 存在。
- [x] 52 fixtures 存在。
- [x] Codex wrapper 存在。
- [x] Claude wrapper 存在。
- [x] Claude command alias 存在且不复制规则。
- [x] fixture validation 通过。
- [x] wrapper validation 通过。
- [x] JSON Schema drift / schema-compatible validation 覆盖 fixtures。
- [x] wrapper parity 深度验证通过。

### v0.1 DoD

- [x] 只读 repo scan helper 存在。
- [x] scan helper 输出设计文档中的 JSON shape。
- [x] scan helper 不读取 secret 内容。
- [x] scan helper 失败不会导致 agent 默认进入 `RUN_WITH_CONTRACT`。

### v0.2 DoD

- [x] Codex export handoff 模板存在。
- [x] Claude export handoff 模板存在。
- [x] GitHub issue handoff 模板存在。
- [x] GitHub issue URL intake helper 存在，并安装为 `.looppilot/scripts/issue-intake.mjs`。
- [x] Claude Code `/should-loop <issue-url>` 和 Codex skill issue URL flow 已记录。
- [x] issue-intake 只读取单个 issue，不读 comments、linked PR、attachments、logs、timeline 或 issue queue。
- [x] issue-intake 对明显 secret/token 做 redaction，对超长 body 做 truncation，并在有评论、URL 指向评论、body 被截断或 issue 文本引用外部上下文时标记 `possibly_incomplete`。
- [x] issue-intake validator 使用 mock GitHub API，覆盖 auth、PR rejection、HTTP errors、output modes 和 no heavy endpoint calls。
- [x] export 必须显式触发。
- [x] export 文件明确说明不是受控执行。
- [x] export validator 纳入 `npm test`。

### v1 Reusable Artifacts DoD

- [x] `VISION.md`、`STATE.md`、`RUN_LOG.md` 模板包含 schema/version/scope/gate/review/next-step 等必需字段。
- [x] `save-vision` 默认写 `.looppilot/VISION.md`。
- [x] `save-state` 默认写 `.looppilot/STATE.md`。
- [x] `save-run-log` 默认写 `.looppilot/RUN_LOG.md`。
- [x] `save-review-gate` 默认继续写 `.looppilot/latest-review-gate.md`。
- [x] 所有 `save-*` 命令要求显式 `--from`，默认 duplicate protection，`--force` 覆盖，`--dry-run` 不写文件。
- [x] package contents validator 确认 package 包含 core/templates/helpers/docs/progress notes，且不包含 generated exports、latest files 或生成的 v1 artifacts；packed CLI runtime 和本地安装 bin smoke test 通过。
- [x] docs consistency validator 确认 README 与全部 `docs/*.md` 和 uppercase artifact、review gate、release-ready CLI surface 保持一致。

---

## 8. 当前可执行检查结果

本次检查运行了：

```bash
npm test
npm run eval:wrapper-parity
node scripts/looppilot.mjs doctor --target both --json
env npm_config_cache=/private/tmp/looppilot-npm-cache npm pack --dry-run
git diff --check
```

结果：通过。

输出摘要：

```text
npm test:
- Schema validation passed.
- Ajv-generated schema validation passed for 52 fixtures and negative probes.
- Fixture distribution: 15 NO_GO, 18 PLAN_ONLY, 19 RUN_WITH_CONTRACT.
- Wrapper, wrapper parity, scan, scan security, Claude project summary, host capability summary, export, fixture coverage, save command, manual template, review-gate template, package contents/runtime smoke, docs consistency, install, and CLI argument validation passed.

eval:wrapper-parity:
- Golden wrapper output parity passed for 6 fixtures, including capability-aware surface differences.

doctor --target both --json:
- ok: true
- package: @looppilot/cli@0.4.0
- installedFileCount: 19
- missingFileCount: 0
- core files include uppercase v1 templates and helper scripts.

npm pack --dry-run:
- Package version: 0.4.0
- includes uppercase v1 templates, issue-intake helper scripts, and docs/progress notes.
- excludes generated `.looppilot/exports/`, `.looppilot/latest-*`, `.looppilot/VISION.md`, `.looppilot/STATE.md`, and `.looppilot/RUN_LOG.md`.

git diff --check:
- no whitespace errors.
```

---

## 9. 一句话方案

**当前已补齐本地 runtime JSON Schema validation、Ajv cross-check、schema drift、wrapper parity、golden wrapper parity eval、fixture coverage taxonomy、只读且报告敏感路径的 scan helper、scan secret-safety、host/Claude helper、agent-native GitHub issue URL intake、显式 export fallback、显式 save commands、manual artifact templates、review-gate template、package contents validation、docs consistency validation、install/doctor integration 与 release-ready `0.2.0` 元数据；后续重点是保持安全门禁稳定，并继续坚持 agent-native、chat-first、no runner、no provider、no GitHub issue queue、no automatic commit/push/deploy。**
