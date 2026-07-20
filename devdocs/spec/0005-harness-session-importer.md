---
title: Spec-0005: Harness Session Importer Skill
description: 通过随 Obsidian Harness 仓库发布的 Agent Skill，将外部 harness 私有历史转换为可离线阅读的 v2 transcript。
type: spec
status: active
version: 1
created: 2026-07-20T13:46:13Z
---

# Spec-0005: Harness Session Importer Skill

## 一、概述

[Spec-0004](0004-acp-turn-transcript.md) 已将本地 transcript 与 ACP continuation 解耦，并明确插件核心不解析外部 harness 私有格式。本 Spec 在该边界之外增加一个随仓库发布的 Agent Skill：它读取用户明确指定的 Claude Code、Codex、Pi Agent 或 Kimi Code session，转换为 Obsidian Harness v2 entry 与 transcript，使既有过程历史可以在 Obsidian 中离线阅读。

Importer 是插件的配套 adapter 工具，不是 Autowiki 能力，也不是 ACP 兼容层。导入结果默认没有 `acpBinding`，不宣称能够恢复原后端会话。

## 二、用户故事

| 编号 | 角色 | 需求 | 目的 | 优先级 |
|------|------|------|------|--------|
| US-016 | Obsidian Harness 用户 | 将一个外部 harness session 导入指定 vault 目录 | 从项目笔记链接并离线阅读已有开发过程 | P0 |
| US-017 | 用户 | 在写入前预览识别出的 turn、消息、工具调用、分支和降级项 | 避免静默导入错误或不完整历史 | P0 |
| US-018 | 用户 | 重复执行相同导入时得到 no-op，而不是重复 session | 允许安全重试和自动化调用 | P0 |
| US-019 | Agent | 依据当前 vault 与项目上下文选择目标目录，再调用确定性脚本 | 将项目路由与私有格式转换解耦 | P1 |

## 三、模块划分

| 模块 | 提供的能力 | 目录路径 | 优先级 |
|------|-----------|---------|---------|
| Skill 工作流 | 识别用户意图、确认来源与目标、先预览后导入、解释 conversion report | `skills/harness-session-importer/SKILL.md` | P0 |
| Source adapters | 分别解析 Claude Code、Codex、Pi Agent 与 Kimi Code 私有 schema | `skills/harness-session-importer/scripts/` | P0 |
| Semantic converter | 将来源记录确定性聚合为 v2 `TurnRecord`，保留顺序、最终状态与完整工具输出 | `skills/harness-session-importer/scripts/` | P0 |
| Import bundle writer | 将转换结果写为 vault 内可链接的来源无关 bundle，不直接修改插件 session storage | `skills/harness-session-importer/scripts/` | P0 |
| Generic materializer | 打开 bundle、展示报告，并通过插件存储服务提交 blob/transcript/receipt/entry/index | `src/services/` + `src/ui/` | P0 |
| Fixtures 与验证 | 使用脱敏 golden fixtures 验证四个 adapter、语义计数、幂等性和失败回滚 | `skills/harness-session-importer/tests/` | P0 |

单个 skill 内的脚本共享同一 v2 输出模型、报告与写入协议，拆成多个可独立安装的 skill 会增加版本漂移，因此本轮保持一个 skill。

## 四、数据模型

### 4.1 Import Request

一次导入至少包含：

| 字段 | 含义 |
|------|------|
| `harness` | `claude`、`codex`、`pi` 或 `kimi` |
| `session` | 用户明确指定的来源文件或 session 目录 |
| `vault` | 目标 Obsidian vault 根目录 |
| `entryDir` | vault 内放置 `.session` 入口的相对目录 |
| `branch` | 来源存在分支时选择的 leaf/branch；无分支时省略 |

### 4.2 Import Bundle

Skill 在 vault 内生成一个轻量 `.harness-import` descriptor 和同名 bundle 目录。descriptor 只包含 bundle schema version、bundle 相对路径与内容摘要；bundle 目录包含 manifest、完整 semantic turns、内容 blob 和 conversion report。插件只理解该来源无关 bundle，不解释 report 中的外部原始 record。

Bundle manifest 同时保存 `sourceDigest` 与 `conversionDigest`。`conversionDigest` 对 semantic turns、blob references 及影响可见结果的 conversion report 字段做 canonical serialization 后计算，converter 版本本身不改变 digest，但任何实际转换结果变化都会改变它。

`.harness-import` 是待导入入口，不是 session。点击后插件先校验并展示报告；只有用户明确确认，generic materializer 才创建 `.session` 与正式 history。

### 4.3 Conversion Report

预览和正式导入都生成结构化 report，至少包含：

- 来源 harness、session identity、来源内容摘要与所选分支；
- 输入记录数，以及输出 turn、prompt、assistant item、tool call/result、thought 数量；
- 每一种 ignored、degraded、ambiguous 记录的类型、数量和原因；
- 目标 entry 路径、稳定 `entryId`/`historyId` 和执行结果；
- `complete` 布尔值。只要存在会影响可见对话、工具结果或 turn 状态的未解决丢失，必须为 `false`。

### 4.4 Import Identity

每个 adapter 从来源自身的 session ID 与分支 ID 构造规范化 source identity，不使用文件路径作为 identity。Skill 从 `harness + normalized source identity + normalized branch identity` 派生稳定 `importId`，并对参与转换的来源文件原始字节按规范顺序计算 `sourceDigest`。

插件从 `importId` 确定性派生 `entryId` 与 `historyId`。`importId + sourceDigest + conversionDigest` 全部相同时，重复 materialize 返回已有 entry，不写任何文件；同一 `importId` 的 `sourceDigest` 变化时报告 source-changed conflict；来源 digest 相同但 `conversionDigest` 变化时报告 converter-output-changed conflict。两种冲突都不得覆盖历史。目标目录变化不改变已导入 entry；用户可在导入后通过 Obsidian 移动 `.session`。

### 4.5 Import Receipt

成功导入后，插件在正式 history 目录保存 `import-receipt.json`，至少包含：

| 字段 | 含义 |
|------|------|
| `schemaVersion` | receipt schema version |
| `importId` | 稳定导入身份 |
| `sourceKind` | 来源 adapter 标识，仅作显示与审计的不透明字符串 |
| `sourceIdentity` / `branchIdentity` | adapter 生成的规范化来源身份 |
| `sourceDigest` | 本次转换输入的内容摘要 |
| `conversionDigest` | canonical semantic turns、blob references 与可见 report 内容的摘要 |
| `converterVersion` | 生成 bundle 的 skill/converter 版本 |
| `complete` / `degradations` | 转换完整性与用户接受的降级项 |
| `materializedAt` / `entryFile` | 插件提交时间与最终入口路径 |

Receipt 是通用导入来源与诊断 sidecar，不改变 v2 `TurnRecord` schema，也不表达 ACP continuation。离线打开 imported history 时，插件读取 receipt 并持续显示 `complete=false` 的降级警告。

### 4.6 Imported Transcript

产物严格使用 [Spec-0004](0004-acp-turn-transcript.md) 的 v2 entry、manifest、TurnRecord 和 BlobRef。导入入口不包含 `acpBinding`；`agentId` 仅表示新建 continuation 的偏好，不得由来源 harness 名称猜测，默认空字符串。

## 五、业务规则

| 规则编号 | 描述 | 约束 |
|----------|------|------|
| BR-020 | 私有格式隔离 | Claude/Codex/Pi/Kimi parser 只能位于 `skills/harness-session-importer/`，不得进入插件 `src/` |
| BR-021 | 预览先行 | Skill 生成 bundle 前必须运行 dry-run；插件 materialize 前必须展示 report，并在 `complete=false` 时要求用户明确接受列出的降级 |
| BR-022 | 不静默丢失语义 | prompt、可见 assistant 内容、tool call/result、相对顺序和有证据的最终状态必须保留；无法映射时报告，不得猜测 |
| BR-023 | 不保存 streaming | 同义重复事件和 chunk 聚合为语义 item，不保存 token/chunk 到达过程 |
| BR-024 | 大型输出无损 | 不截断工具输出；超过 v2 阈值时使用内容寻址 BlobRef，先写 blob 后提交 TurnRecord |
| BR-025 | 分支显式化 | 来源有多个有效 leaf/branch 时不得按文件顺序混合；必须明确选择或分别导入 |
| BR-026 | 只读导入 | 不生成 `acpBinding`，不把来源 session ID 当作 ACP session ID，不承诺原后端恢复 |
| BR-027 | 幂等与冲突 | `importId + sourceDigest + conversionDigest` 与 receipt 相同为 no-op；source digest 变化报告 source-changed，只有 conversion digest 变化报告 converter-output-changed；来源路径和目标目录不参与 identity |
| BR-028 | Vault 边界 | 所有目标路径 canonicalize 后必须位于显式 `vault` 内；拒绝绝对 `entryDir`、`..` 穿越和插件目录结构不兼容 |
| BR-029 | 单写者提交 | Skill 不写正式 history、entry 或 index；generic materializer 通过插件存储服务提交，所有 session storage 写入仍由插件单写者拥有 |
| BR-030 | 项目路由外置 | Folder Bridge、PJ 命名或笔记语义由调用 Agent 解析，converter 只接受显式 `entryDir` |
| BR-031 | 提交与恢复 | 插件先验证 bundle 与 blob hash，再写 staging history；依次发布 history、receipt、entry、index，并以 transaction journal 恢复进程中断；恢复后要么完整可见，要么回到导入前状态 |
| BR-032 | Receipt 持久警告 | `complete=false` 只有在用户确认后可提交；receipt 必须保留全部 degradations，离线工作区持续显示而非仅在导入时提示 |

## 六、Skill 交互约束

1. Skill 必须先确认来源路径、harness 和 vault；目标目录可从当前项目上下文推断，但最终作为显式参数传给脚本。
2. 默认先展示简短 dry-run 摘要；conversion report 保留机器可读 JSON。用户同意后，Skill 生成 `.harness-import` descriptor 并返回其 wikilink。
3. `complete=false` 时，Agent 必须指出缺失的是哪类语义以及影响范围，不得只显示“有 warning”；插件确认界面再次展示相同降级项。
4. 用户点击 descriptor 并确认后，插件返回可点击的 `.session` 路径；导入结果表现为“只读历史”。
5. Skill 不扫描整个用户目录、不批量导入所有历史，除非用户明确给出批量范围；批量 scan UI 不在本轮范围。

## 七、非功能指标

| 维度 | 指标 |
|------|------|
| 完整性 | golden fixture 中所有可见 prompt、assistant 内容和 tool result 字节级保留；不允许固定长度截断 |
| 可审计性 | 每次预览和导入均可输出 JSON conversion report，所有 ignored/degraded 类型均有计数与理由 |
| 幂等性 | 相同 bundle 连续 materialize 两次，第二次不修改 entry、history、blob、receipt 或 index |
| 故障安全 | 在 blob、history、receipt、entry 或 index 发布点模拟进程中断并执行 journal recovery 后，这五类可见状态全部提交或全部回到导入前 |
| 性能 | 单文件流式解析，不要求把完整大型 JSONL 和全部工具输出同时载入内存 |
| 可移植性 | Python 3 标准库运行；vault 通过参数或可靠发现获得，不硬编码个人路径 |
| 边界 | 架构测试确认插件 `src/` 不包含四种私有 schema parser 或默认存储路径 |

## 八、范围外

- 从 imported history 恢复原 harness session
- 跨 ACP Agent session 迁移或上下文蒸馏
- 在插件核心中扫描或解析外部 harness 私有历史
- 由外部脚本直接写正式 plugin history、`.session` 或 `session_index.jsonl`
- 自动扫描并导入用户机器上的全部历史
- 将外部 sub-agent graph 投影成插件内多 Agent graph
- 原始 token streaming 时序、加密 reasoning 或供应商内部控制事件的归档
- 对仍在增长的来源 session 做增量覆盖
