---
title: ADR-0006: Session Import Skill 与 Materialization 边界
description: 将外部 harness parser 隔离在同仓库 Agent Skill，以来源无关 bundle 和插件单写者事务完成 v2 session 导入。
type: adr
status: accepted
created: 2026-07-20T13:46:13Z
---

# ADR-0006: Session Import Skill 与 Materialization 边界

## 背景

[ADR-0005](0005-turn-transcript-storage.md) 决定插件核心只接收 ACP-normalized 输入，不解析外部 harness 私有 schema。现有 E1 Python 原型位于 Autowiki skill，直接写 `.session`、history 和 `session_index.jsonl`。它证明 imported v2 history 可以离线渲染，但同时暴露三个架构问题：Autowiki 承担了不属于知识图谱的产品能力；外部进程与运行中的插件争用 session storage；转换错误会静默丢失私有历史语义。

[Spec-0005](../spec/0005-harness-session-importer.md) 要求把 converter 作为 Obsidian Harness 配套 skill 发布，同时保持插件 ACP-only。还要求稳定导入身份、持久 conversion receipt、显式降级与进程中断恢复。

## 决策

**在 Obsidian Harness 仓库内发布 `skills/harness-session-importer/`，由 skill 将外部私有历史转换为来源无关 import bundle；插件核心只负责校验和 materialize bundle，并保持正式 session storage 的唯一写者。**

### 1. 发布与安装边界

Importer 使用标准 Agent Skills 目录：

```text
skills/
└── harness-session-importer/
    ├── SKILL.md
    ├── scripts/
    ├── references/
    └── tests/
```

Skill 与插件源码同仓库、随版本共同演进，通过 skit 或兼容 Agent Skills 的工具单独安装。Obsidian 社区插件的运行时资产仍是 `main.js`、`manifest.json` 与 `styles.css`；Python parser 不打包进 `main.js`，也不在插件启动时执行。

### 2. 私有 Adapter 边界

Claude Code、Codex、Pi Agent 与 Kimi Code 的 schema、默认存储路径、分支选择和去重规则只存在于 skill。每个 adapter 输出共享的内部 semantic turn candidate 和 conversion diagnostics，再由 bundle writer 生成通用格式。

插件 `src/` 不得出现四种来源的 parser、默认路径或私有 event discriminator。`sourceKind` 在插件中只是 receipt 展示用的不透明字符串，不参与来源特定逻辑。

### 3. 文件交接协议

Skill 不直接调用或修改插件的正式存储。它在用户显式指定的 vault 中发布：

```text
<name>.harness-import
<name>.harness-import.bundle/
├── manifest.json
├── turns.jsonl
├── report.json
└── blobs/
    └── sha256-<digest>
```

`.harness-import` 是小型 descriptor，可被 Obsidian wikilink 和专用 View 打开。descriptor 使用 vault-relative bundle path，且包含 bundle manifest digest。bundle 中所有数据在 descriptor 发布前完成写入、fsync、hash 校验和同文件系统 rename；因此插件永远不会把 staging 目录识别为候选导入。

Bundle 是版本化的导入接口，不是第二份长期 session schema。成功 materialize 后，正式 v2 transcript 仍是唯一权威历史；bundle 可由用户保留或在明确操作后删除。

### 4. 身份与摘要

Adapter 从来源自带 session ID 和显式 branch ID 生成规范化 source identity。文件路径、目标 entryDir 和 importer 安装位置不参与身份。

```text
importId = UUIDv5(namespace, sourceKind + sourceIdentity + branchIdentity)
entryId  = UUIDv5(importId, "entry")
historyId = UUIDv5(importId, "history")
```

- `sourceDigest`：按 adapter 定义的稳定文件顺序，对参与转换的原始文件字节计算 SHA-256。
- `conversionDigest`：对 canonical turns、BlobRef 和影响可见结果的 report 字段计算 SHA-256。
- `converterVersion`：诊断字段；版本字符串自身不决定冲突，实际产物变化由 conversionDigest 表达。

三者比较规则：

| 比较结果 | Materializer 行为 |
|----------|-------------------|
| importId/sourceDigest/conversionDigest 全相同 | 返回既有 entry，严格 no-op |
| importId 相同，sourceDigest 不同 | source-changed conflict |
| importId/sourceDigest 相同，conversionDigest 不同 | converter-output-changed conflict |

### 5. Import Receipt

Materializer 在正式 history 目录保存版本化 `import-receipt.json`。Receipt 保存 importId、来源/分支 identity、两个 digest、converterVersion、complete/degradations、materializedAt 和 entryFile。

Receipt 不修改 `TurnRecord`，不保存外部 raw event，不创建 ACP binding，也不把 imported 定义为 continuation 状态。它提供幂等比较、来源审计和持久警告。Receipt 缺失或损坏不阻止合法 v2 turn 的降级只读投影，但必须显示 provenance/integrity warning。

### 6. Generic Materializer

插件注册 `.harness-import` View。打开 descriptor 只读取、校验并展示 report，不启动 Agent、不写正式 storage。用户确认后，materializer 才调用插件自己的 session storage 服务。

Materializer 只处理通用结构：bundle version、turn schema、blob hash、receipt 字段、目标 vault path 和用户确认。它不得分支判断 `sourceKind`。

### 7. 单写者事务与恢复

Materialize 使用插件内互斥队列按 importId 串行化；SessionStorage 另以共享 mutation queue 串行化所有 session index 新增、删除与 import 提交，防止普通 session 创建和 materializer 的异步写入交错。Materializer 在正式 storage 内维护 transaction journal：

```text
sessions/import-transactions/<importId>.json
```

Journal 记录 transaction ID、bundle digest、最终路径和当前阶段。Journal 本身通过临时完整文件 + rename 原子替换。提交顺序固定为：

1. 校验整个 bundle 与所有 hash；
2. 获取 importId mutex 与共享 SessionStorage mutation queue，完成幂等/冲突检查；
3. 在任何 staging 或正式写入前，原子发布 journal `preparing`；
4. 写 staging history、blob 与 receipt，完整读回校验后原子更新 journal 为 `prepared`；
5. rename 发布正式 history；
6. 以临时文件 + rename 原子创建 vault `.session` entry；
7. 读取并校验完整 index，在临时文件写入包含新 entry 的完整内容，再以 rename 原子替换 index；不得 append；
8. 原子更新 journal 为 `committed`，确认全部身份可读后删除 journal 和 staging。

插件启动和打开 import descriptor 前执行 recovery。对每个合法 journal，根据阶段和确定性 identity 完成以下收敛：

- index 已含正确 entry 且 entry/history/receipt 完整：完成提交并清理 journal；
- journal 为 `preparing` 或 `prepared` 且 index 尚未发布：移除本 transaction 确定性命名的 entry/history/staging，恢复到导入前；journal 在 staging 之前存在，因此不存在无法归属的 importer staging；
- 任一现有文件 identity 或 digest 与 journal 不符：停止自动恢复，保留文件并显示持久冲突，不猜测删除。

Blob 位于该 history 的 `blobs/` 内，随 staging history 一起 rename，不单独暴露半提交状态。Index 是最后一个使 session 出现在 manager 列表中的发布点；vault entry 若在 index 前短暂存在，也由 journal 明确识别并在 recovery 回滚。Index 原子替换保证进程中断只留下旧完整版本或新完整版本，不产生截断 JSONL。

本协议保证应用进程中断后的收敛，不宣称超出 Obsidian Vault adapter 与底层文件系统能力的断电持久性。

### 8. Conversion 完整性

Converter 不保存 token streaming。它必须保留可见 prompt、assistant message、tool call/result、相对语义顺序和有来源证据的状态；大型输出使用与 v2 相同的 canonical JSON 与 BlobRef 规则，不截断。

未知、孤立或无法确定的来源记录必须进入 report。影响可见语义或状态时 `complete=false`，不能用猜测值换取绿色导入。用户接受降级后，完整 degradations 进入 receipt 并在 imported workspace 持续显示。

## 备选方案

### A. 插件直接解析四种私有 schema

调用链短，但破坏 ACP 边界，使插件发布和测试被外部产品格式变化驱动。拒绝。

### B. Skill 直接写插件 storage

无需插件 UI，但无法与运行中的 Obsidian 协调 index 单写者，也无法跨多个文件提供可靠中断恢复。拒绝。

### C. 要求导入时关闭 Obsidian

可以降低并发风险，但体验差、无法可靠证明进程已关闭，也不能解决中断后半成品。拒绝。

### D. 单文件 bundle 内嵌所有输出

易于传递，但大型工具结果会使 descriptor 巨大，增加 vault 同步和解析成本。拒绝；采用小 descriptor + bundle 目录。

### E. Bundle 成为长期权威历史

避免复制，但迫使 reader 同时支持 bundle 与 v2 transcript 两种真相。拒绝；materialize 后仍以 v2 为唯一权威。

## 后果

### 正面

- 私有格式变化由可独立升级和测试的 skill 吸收，插件继续只负责 ACP 与自身通用 schema。
- 用户可以在写入前审查 conversion report，并在 Obsidian 内显式确认。
- 插件保持正式 session storage 单写者，可以提供幂等、冲突和中断恢复。
- Skill 与插件同仓库版本化，schema 变化可在同一 release 中协调。

### 负面

- 导入变成“Agent 生成 bundle → 用户在 Obsidian 确认”的两步流程。
- 新增 descriptor View、receipt reader 和 transaction recovery，插件实现范围增加。
- Bundle 在成功导入后可能占用重复空间，需要未来提供明确的清理操作。
- 外部私有格式变化仍需要维护四套 adapter fixture。

## 验证

本 ADR 不引入新的库、进程间协议或未知平台能力：skill 使用 Python 3 标准库，插件使用现有 Obsidian Vault adapter、SessionStorage、FileView 和确定性 hash 能力。核心风险是约定的故障恢复语义，将由 [AC-0018](../ac/0004-harness-session-importer.md) 的参数化发布点中断测试和真实 Obsidian E2E 验证，不另建技术选型 spike。

## 约束范围

`skills/harness-session-importer/`、generic import bundle interface、`.harness-import` View、session materializer、import receipt、transaction journal、相关测试与用户文档。

## 约束规则

| 规则编号 | 规则 | 适用范围 | 违反时如何检出 |
|----------|------|----------|----------------|
| AR-006-01 | 外部 harness 私有 parser/default path 只能存在于 importer skill | repository boundary | AC-0015-B-2 architecture test |
| AR-006-02 | Skill 只发布 bundle，不写正式 session storage | converter/materializer boundary | AC-0015-N-1 + architecture test |
| AR-006-03 | 插件 materializer 不按 sourceKind 分支 | `src/` | architecture test + code review |
| AR-006-04 | importId、sourceDigest、conversionDigest 和 receipt 共同定义幂等与冲突 | identity lifecycle | AC-0017 |
| AR-006-05 | 所有正式写入由插件单写者和共享 index mutation queue 执行，journal 先于 staging，index 以完整文件原子替换 | session storage | AC-0018 |
| AR-006-06 | complete=false 必须由用户显式接受并持久显示 degradations | import UI + history UI | AC-0016-B-1 + AC-0019-B-1 |
| AR-006-07 | Imported receipt 不表达或否定 ACP continuation | entry/history lifecycle | AC-0019 + code review |
| AR-006-08 | 大型输出不截断，使用 v2 canonical BlobRef | converter + bundle | AC-0015-B-1 |

## 与既有决策的关系

| 既有规则 | 处理 |
|----------|------|
| ADR-0005 AR-005-01 semantic TurnRecord | 保留；converter 直接产出同一语义模型 |
| ADR-0005 AR-005-02 三种身份分离 | 保留；importId 是额外来源身份，不替代 entry/history/ACP session ID |
| ADR-0005 AR-005-06 插件不解析私有 schema | 保留并以 repository architecture test 强化 |
| ADR-0005 AR-005-08 blob 先于 TurnRecord | 保留；bundle 与 materializer 使用相同 hash 和发布约束 |
