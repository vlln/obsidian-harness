---
title: ADR-0005: Turn Transcript 存储
description: 采用 ACP 语义 turn snapshot、稳定本地身份、活动 turn 检查点和内容寻址 blob，解耦离线历史与 ACP continuation。
type: adr
status: proposed
created: 2026-07-20T09:49:32Z
---

# ADR-0005: Turn Transcript 存储

## 背景

[Spec-0004](../spec/0004-acp-turn-transcript.md) 要求 session 历史在原 Agent、cwd 或网络不可用时仍可阅读，并明确区分本地历史与 ACP continuation。现有 [ADR-0003](0003-session-entry.md) 把原始 ACP `SessionUpdate` 逐条追加到 `main.jsonl`，同时复用 backend session ID 定位历史。该方式保留了传输过程，却使长期格式依赖 streaming 合并规则，也让历史身份和后端生命周期耦合。

四种外部 harness 的 schema 比较说明了完整 message、tool call/result、稳定记录身份和大型结果外置的价值，但它们只是设计参考。Obsidian Harness 的输入边界始终是 ACP，不扫描、解析或兼容任何 Agent 产品的私有历史格式。

本 ADR 取代 ADR-0003 中“backend session ID 定位 history”“`main.jsonl` 保存原始 ACP 事件”“首行为 v1 metadata”的存储规则。ADR-0003 关于 `.session` 作为 vault 入口、入口不内嵌历史且可被 wikilink 引用的决策继续有效。

## 决策

**将 ACP streaming update 聚合为完整语义 turn，并持久化为唯一权威 transcript；本地历史身份、vault 入口身份和 ACP session 身份彼此独立。**

### 1. 身份分离

| 身份 | 所有者 | 生命周期 | 规则 |
|------|--------|----------|------|
| `entryId` | `.session` 入口 | 跟随 vault 文件代表的用户入口 | 文件移动、重命名和 ACP 恢复不改变它 |
| `historyId` | 本地 transcript | 跟随一份语义历史 | 创建后稳定；存储目录只由它定位 |
| `acpSessionId` | ACP Agent | 跟随后端 continuation | 可选、不透明；不得用作 entryId 或 historyId |

`.session` 保存 entry 元数据、historyId 和可选 continuation binding。`connected`、`imported`、`read-only` 不落为互斥的持久化总状态；本地历史是否存在、binding 是否存在以及当前设备能否恢复分别计算。

### 2. 存储布局

```text
vault/
└── Projects/example/example.session

.obsidian/plugins/obsidian-harness/
└── sessions/
    └── <historyId>/
        ├── manifest.json
        ├── turns.jsonl
        ├── active-turn.json
        └── blobs/
            └── sha256-<digest>
```

- `manifest.json`：schema version、historyId、创建/更新时间、迁移 provenance 和 transcript 级元数据。它不记录后端在线状态。
- `turns.jsonl`：每行一个完整、不可变的 `TurnRecord`。JSONL 提供增量提交和行级故障隔离，但记录单位是语义 turn，不是 ACP event。
- `active-turn.json`：最多一个正在聚合的 turn snapshot，通过同目录临时文件 + rename 原子覆盖。它是崩溃恢复检查点，不是 event journal。
- `blobs/`：超过阈值的大型内容，以 canonical bytes 的 SHA-256 为文件名不可变存储。

manifest、TurnRecord、active turn 与 blob reference 都带 schema version。具体业务字段由 Spec 和后续 TypeScript interface 定义，本 ADR 只约束边界与持久化语义。

### 3. ACP 聚合边界

ACP Client 负责记录发出的完整 prompt，并把当前 ACP turn 的 `SessionUpdate` 聚合到内存模型：

- text/thought chunk 合并为完整语义 item，不保存 chunk 到达次数、token 边界或时间序列；
- tool call/update 以 ACP `toolCallId` upsert，完成时只保留最终 snapshot 和语义顺序；
- plan、permission interaction、error、最终 usage 和 stop reason 在可用时进入 turn；
- 未知 ACP update 不能直接作为原始 event 写入 transcript；需要映射为版本化的 `unknown` semantic item，或被明确忽略并记录诊断。

ACP SDK 类型只存在于 `src/acp/`。Transcript 类型位于 `src/types/` 且不依赖 SDK；聚合器接收项目内部 ACP-normalized update。外部 harness adapter 不进入插件核心。

### 4. 提交与崩溃恢复

活动 turn 按合并、限频策略覆盖 checkpoint，不因每个 streaming chunk 同步写盘。正常完成时采用以下顺序：

1. 先持久化并校验本 turn 引用的新 blob；
2. 向 `turns.jsonl` 追加一个完整 TurnRecord；
3. 确认该 turnId 可读取后删除 `active-turn.json`。

如果进程在步骤之间退出，turnId 提供幂等边界：reader 对 turns 中已存在的 turn 忽略同 ID 的陈旧 checkpoint；只有 checkpoint、没有 completed record 时，将其投影为 `interrupted`，不得伪造完成时间或 stop reason。下一次可写恢复可将它恰好一次地提交为 interrupted record。

存储失败不终止 ACP streaming，但 UI 必须持续显示“历史未保存”。内存 aggregate 和最后有效 checkpoint 在成功重试前不得清除，也不得把未提交内容报告为已持久化。

### 5. 单一权威历史与 UI Projection

`manifest.json`、`turns.jsonl`、有效 active checkpoint 和其引用的 blobs 共同组成唯一权威 transcript。`ChatMessage[]`、tool call 展开状态、plan panel 与 continuation badge 都是可重建的运行时 projection，不另存第二份消息真相。

Reader 按文件顺序读取合法、turnId 唯一的 TurnRecord。单行损坏不阻止其他行读取，但必须产生工作区内的持久警告。manifest 损坏时允许以 entry 和合法 turns 做降级只读投影；checkpoint 损坏时忽略它并报告文件；blob 缺失或 hash 不匹配时显示带期望 hash 的占位，不隐藏其余历史。

### 6. 阅读与 Continuation 解耦

打开 `.session` 的固定顺序是：

1. 读取 entry；
2. 读取本地 transcript；
3. 立即渲染历史；
4. 仅从本机静态配置、binding 和 cwd 等条件计算 continuation 候选状态。

以上过程不得 spawn Agent 或调用 ACP `session/load`、`session/resume`、`session/new`。只有用户明确执行继续操作时才连接 Agent 并进入 `restoring`。恢复失败保留历史并进入 backend unavailable/read-only 状态，绝不自动调用 new session。新建 ACP session 是独立且明确的用户命令。

### 7. v1 兼容与迁移

v2 reader 保留 v1 raw `SessionUpdate` 的只读兼容 projection。需要首次 v2 写入时才迁移：

1. 为 entry 分配并持久保持一个 historyId；
2. 从 v1 source 构建带 source path、schema version 和 content fingerprint 的 migration provenance；
3. 在独立临时目录生成 manifest、turns 和 blobs；
4. 重新读取并校验 turnId 唯一性、引用完整性和 source fingerprint；
5. 原子发布 v2 目录并更新 `.session` 指向；
6. 保留 v1 source，不在本轮自动删除。

重复迁移根据 entry、provenance 和 fingerprint 复用同一结果。无法确定的 v1 message 边界必须标记 inferred，未完成序列标记 interrupted。任何失败都不切换入口，不覆盖原文件；临时目录可安全清理后重试。

### 8. 大型内容

阈值以下的 content block 内联。阈值以上的 tool output/resource 使用 `BlobRef`，至少包含 SHA-256、mediaType、byteLength 和可读 preview。Blob 先于引用它的 TurnRecord 落盘；相同内容天然去重。缺失或校验失败是局部可见错误，不使整个 transcript 不可读。

## 备选方案

### A. 保留原始 ACP event journal

优点是写入路径简单、便于重放 streaming；缺点是长期 schema 与传输过程耦合，UI 每次读取都要重新推断消息和 tool 最终态，无法稳定表达完整 turn。拒绝。

### B. 每个 turn 一个 JSON 文件

优点是单 turn 替换简单、局部损坏隔离更强；缺点是长 session 产生大量小文件，增加 Obsidian 插件目录同步和索引成本。拒绝，completed turns 使用 JSONL，只有 active turn 单独覆盖。

### C. 把完整 transcript 写进 `.session`

优点是同步和分享只有一个文件；缺点是每次提交重写 vault 文件，增加同步冲突并让入口文件频繁变化。拒绝，入口继续保持轻量。

### D. 只持久化 UI `ChatMessage[]`

优点是渲染直接；缺点是丢失 turn、prompt、tool、usage 和迁移 provenance 等领域语义，并形成 UI 与协议耦合。拒绝。

### E. 插件直接兼容各 harness 私有 schema

优点是可直接导入现有历史；缺点是破坏 ACP 边界，使核心随外部产品格式变化。拒绝；未来导入器必须是独立 adapter，只产出本 ADR 的 transcript。

## 后果

### 正面

- 本地历史无需 Agent 即可离线阅读和同步。
- 用户感知上明确区分“历史存在”和“后端可继续”。
- 不保存 streaming，长期格式更紧凑且语义稳定。
- active checkpoint 为长任务提供可控的崩溃恢复。
- 稳定本地身份允许未来更换 binding、fork 或导入而不改写历史定位。

### 负面

- 需要新的聚合器、projection reader 和 v1 migration，写入路径比 raw append 更复杂。
- completed turn 前的最新内容最多损失一个 checkpoint debounce 窗口。
- JSONL append、blob 提交和 checkpoint 删除无法组成单个文件系统事务，必须依赖 turnId 幂等恢复。
- 原 v1 与 v2 在兼容期会占用重复空间。

## 验证

本 ADR 不引入新的外部技术选型，属于内部存储与边界约定，无需 spike。可行性由 [AC-0003](../ac/0003-acp-turn-transcript.md) 的自动化证据验证：纯聚合器 golden fixtures、文件系统故障注入、v1 migration fixtures，以及断言离线打开不 spawn Agent 的 Obsidian E2E。

## 约束范围

`src/types/`、`src/acp/`、`src/services/`、`src/hooks/`、`.session` schema、history workspace UI 与迁移测试。

## 约束规则

| 规则编号 | 规则 | 适用范围 | 违反时如何检出 |
|----------|------|----------|----------------|
| AR-005-01 | completed history 只保存语义 TurnRecord，不保存 streaming chunk journal | transcript writer | AC-0008 单元测试 + code review |
| AR-005-02 | entryId、historyId、acpSessionId 是三个独立身份 | entry/transcript/ACP lifecycle | 类型测试 + AC-0011 |
| AR-005-03 | active turn 只能原子覆盖，不能逐 event 追加 | checkpoint writer | AC-0009 故障注入 |
| AR-005-04 | 本地 transcript 是唯一权威历史；UI message state 仅为 projection | storage + hooks + UI | architecture test + code review |
| AR-005-05 | 打开历史不得启动 Agent；恢复失败不得隐式 new session | lifecycle + UI | AC-0010/AC-0011 E2E |
| AR-005-06 | 核心只接受 ACP-normalized 输入，不解析外部 harness 私有 schema | `src/` | import-boundary test + code review |
| AR-005-07 | v1 迁移幂等、非破坏，校验完成前不得切换入口 | migration service | AC-0012 fixtures |
| AR-005-08 | blob 必须先于引用落盘并按 SHA-256 校验 | blob/turn writer | AC-0014 故障注入 |

## 与既有决策的关系

| 既有规则 | 处理 |
|----------|------|
| ADR-0003 AR-001 `.session` 为 JSON vault 入口 | 保留；字段演进到 entryId/historyId/可选 ACP binding |
| ADR-0003 AR-002 raw ACP update 追加到 history | 被本 ADR AR-005-01 取代 |
| ADR-0003 AR-003 `main.jsonl` 首行为 metadata | 被 manifest + `turns.jsonl` 布局取代 |
| ADR-0003 AR-004 入口不含 history | 保留 |
| ADR-0003 AR-005 入口可被 wikilink 引用 | 保留 |
