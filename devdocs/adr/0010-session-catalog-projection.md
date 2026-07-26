---
title: ADR-0010: Session Catalog Projection
description: 以 .session 为元数据真相、index 为发现入口、运行时注册表为瞬时状态，通过可订阅内存 Catalog 驱动 Session Navigator。
type: adr
status: accepted
created: 2026-07-26T05:39:33Z
---

# ADR-0010: Session Catalog Projection

## 背景

[Spec-0006](../spec/0006-session-navigator.md) 要求现有 `SessionManagerView` 成为实时的
全局 Session Navigator：按 Projects 和 Recents 投影所有 Session，支持搜索，并在 Session
行右侧合并当前运行状态。[ADR-0003](0003-session-entry.md) 已决定 `.session` 是 vault
中的一等入口，`session_index.jsonl` 用于入口发现；本 ADR 不改变该身份和存储模型。

当前实现存在三个不足：

1. `SessionManagerView` 自行读取一次 index，组件挂载后不会跟随 entry 或 index 更新；
2. index 只包含 entryId、historyId、cwd 和 entryFile，不含权威 title、agentId 和时间；
3. `ChatViewRegistry` 跟踪的是部分 UI container，而 `.session` 的
   `HarnessSessionView` 不实现 `IChatViewContainer`，不能用现有 view 列表完整判断
   Session 的运行状态。

需要一个不依赖 React、不复制持久化真相、可供 `useSyncExternalStore` 安全订阅的领域投影。

## 决策

**新增插件生命周期内唯一的 `SessionCatalogService`。它从 index 发现 Session，读取并校验
`.session` 权威元数据，合并独立的 `SessionRuntimeRegistry` 和 workspace 选中态，发布稳定、
不可变的内存 snapshot。Catalog 自身不持久化任何 Session 元数据或运行状态。**

### 1. 权威来源与职责

| 信息 | 权威来源 | Catalog 行为 |
|------|----------|--------------|
| entryId、historyId、title、agentId、cwd、createdAt、updatedAt | `.session` | 解析、校验并投影；不得用 index 同名字段覆盖 |
| entryFile 发现和快速身份映射 | `session_index.jsonl` | 读取候选入口；不把 index 扩充为第二份展示元数据数据库 |
| ready、busy、permission、error、disconnected | `SessionRuntimeRegistry` | 按 entryId 合并为可选 `runtimeStatus`；不落盘 |
| 当前选中 Session | Obsidian workspace 活动 FileView | 将活动 `.session` 路径映射为 entryId；不写入 entry |
| Project 和 Recents | Catalog 纯投影 | 由 cwd 和 updatedAt 确定性生成；不持久化 Project 实体 |

`.session` 与 index 发生冲突时，Catalog 不猜测覆盖：能由合法 entryId 和 entryFile 唯一解析
的条目进入正常列表，缺失、重复身份、schema 错误或字段冲突进入 `issues`。内容完全相同的
重复 index 行按一个候选读取并交给 reconciliation 压缩；同一 entryId 指向两个不同且都存在
的 entryFile 属于身份冲突，不自动选择。已有孤儿 index 清理沿用 SessionStorage 生命周期
规则，Catalog 不直接绕过存储服务修改 index。

### 2. Catalog Snapshot

`SessionCatalogService` 暴露稳定的 `subscribe()` 与 `getSnapshot()`，snapshot 至少包含：

```text
SessionCatalogSnapshot
├── phase: loading | ready | error
├── items: SessionCatalogItem[]
├── projects: SessionProjectGroup[]
├── recentSessions: SessionCatalogItem[]
├── selectedEntryId: string | null
└── issues: SessionCatalogIssue[]
```

- snapshot 及其数组在发布后不可变；没有实际变化时保持引用稳定；
- `projects`、`recentSessions` 和搜索输入使用同一组规范化 `items`，不得复制实体；
- loading 不等于空 Catalog；首次读取完成前 UI 使用明确 loading phase；
- 刷新失败保留最后成功的 items/projects/recents，并在 phase/issues 中暴露错误；
- issue 包含可定位的 entryFile/entryId（可用时）、错误类别和用户可显示信息，不包含凭据。

React 组件仅通过 `useSyncExternalStore` 消费 snapshot。组件不得直接读取 index、遍历 vault
或维护自己的持久 Session 副本。

### 3. 初始构建与确定性投影

Catalog 初始构建按固定顺序执行：

1. 从 SessionStorage 读取完整 index snapshot；
2. 按 entryId 和 entryFile 检查重复与冲突；
3. 对候选 `TFile` 使用 Obsidian Vault API 读取并调用现有 `parseSessionFileData`；
4. 校验 index identity 与 entry identity，生成合法 `SessionCatalogItem` 和 issues；
5. 合并 Runtime Registry 与 workspace active leaf；
6. 按 Spec-0006 BR-031 的稳定排序生成 Projects 和 Recents；
7. 原子发布单个 snapshot。

文件读取使用有限并发，默认上限 16，避免 500 个 Session 时串行等待或同时发起无界 I/O。
一次构建使用 generation token；新 refresh 开始后，旧 generation 的异步结果不得覆盖新结果。

Project displayName 由 cwd 的最短可区分路径后缀计算。cwd 不存在只影响 continuation，
不影响 Catalog 收录和分组。

### 4. 实时刷新

Catalog 订阅并合并以下事件：

- vault 的 `.session` create、modify、rename、delete；
- SessionStorage 的 index mutation 通知；
- `SessionRuntimeRegistry` snapshot 变化；
- workspace active leaf 变化。

SessionStorage 增加串行、幂等的 entry reconciliation：给定已解析的 `SessionFileData` 和
当前 entryFile，保证 index 对该 entryId 恰好保留一条正确映射。plugin lifecycle 在有效
`.session` create 和 rename 事件后调用 reconciliation；delete 继续走既有级联清理。由此，
用户在 Obsidian 文件树或同步工具中创建/重命名有效 entry 时，先修复派生 index，再由 index
mutation 通知 Catalog。若发现同一 entryId 对应两个仍存在的文件，reconciliation 停止写入并
发布 conflict issue，不覆盖任一文件。Catalog 本身仍是只读模型。

entry/index 文件事件按 50 ms 窗口合并成一次 refresh，以吸收创建 entry 后更新 index、重命名
以及外部同步产生的事件突发。refresh 完成仍需满足 AC-0018 的 500 ms 可见性上限。

Runtime 和选中态变化不重新读取磁盘：只在最后成功的规范化 items 上重新合并并发布。只有
entry/index 变化触发异步重建。所有订阅由 plugin lifecycle 持有并在 `onunload` 解除；
`SessionManagerView` 关闭不得销毁共享 Catalog。

### 5. 独立 SessionRuntimeRegistry

在 `src/services/view-registry.ts` 中新增与 `ChatViewRegistry` 并列的
`SessionRuntimeRegistry`。它不跟踪 DOM container 或控制 view 生命周期，只跟踪：

```text
entryId -> viewId -> SessionRuntimeStatus
```

每个绑定 `sessionEntry.entryId` 的 `ChatPanel` 在 mount 时注册，在 status 变化时更新，在
unmount 时注销。因此 `ChatView`、`FloatingChatView` 和 `HarnessSessionView` 使用同一条状态
上报路径，不要求三种宿主实现相同 container interface。

同一 entryId 有多个实例时按以下优先级合并：

```text
permission > error > busy > ready > disconnected
```

最后一个实例注销后该 entryId 状态为 null。Runtime Registry 只接受项目内部
`SessionRuntimeStatus`，不导入 ACP SDK 类型，也不保存 title 或 entryFile。

### 6. 搜索边界

搜索是 Catalog item 上的纯内存 projection，不属于 service 的持久状态。UI 将 query
trim 并进行 locale-insensitive lowercase 规范化，匹配 title、Project displayName、cwd、
entryFile 和 agentId。搜索结果按 Catalog 的 Recents 稳定顺序返回，每个 entryId 最多一次。

Project 展开状态、Show more 状态和 query 是单个 Navigator view 的 UI 状态；它们不进入
共享 Catalog，也不跨 Obsidian 重启持久化。

### 7. 生命周期操作边界

Catalog 是读模型，不直接实现 Create、Rename 或 Delete。Navigator 命令调用 plugin/service
现有生命周期入口；命令完成后由 vault/index 事件驱动 Catalog 收敛。UI 不做“先从列表删除”
之类可能掩盖存储失败的乐观更新。

Open 和 Reveal 在执行时用 entryId 从最新 snapshot 重新解析 entryFile。Rename/Delete 同样
不得仅信任菜单打开时捕获的旧路径。操作失败后触发权威 refresh，UI 展示实际磁盘状态。

## 备选方案

### A. 继续由 SessionManagerView 自行加载和合并

代码改动较少，但每个 view 各有异步状态、事件订阅和错误恢复，无法共享稳定 snapshot，
也会把 vault/index 逻辑放进 React。拒绝。

### B. 将 title、agentId、updatedAt 和 runtimeStatus 全部写入 index

列表读取更快，但会让 `.session` 与 index 成为两份可冲突的用户元数据；runtimeStatus 还会把
进程瞬时状态错误持久化。拒绝。

### C. 每次刷新扫描 vault 中所有 `.session`

可绕过 index 不一致，但改变 ADR-0003 已确定的发现边界，vault 规模越大扫描成本越高，且
无法利用 importer/session lifecycle 已维护的 index。拒绝；损坏 index 作为可见 issue 处理。

### D. 让 HarnessSessionView 实现完整 IChatViewContainer

可复用现有 ChatViewRegistry，但会为了状态图标迫使 FileView 实现发送、广播、浮窗折叠等
无关接口，并仍遗漏 ChatPanel 级状态变化通知。拒绝，运行态采用更窄的 registry。

### E. 引入 React Query、Redux 或外部数据库

这些方案可提供缓存和订阅，但本需求只有本地文件与内存投影，现有 observer +
`useSyncExternalStore` 模式足够；新增依赖不会消除 source-of-truth 和事件一致性问题。拒绝。

## 后果

### 正面

- `.session` 继续是唯一用户元数据真相，不产生 Catalog 数据迁移或双写。
- 多个 Navigator view 共享同一个实时 snapshot，排序、搜索和错误语义一致。
- 所有 ChatPanel 宿主通过 entryId 上报状态，不依赖具体 view container 类型。
- 运行状态和选中态变化不触发磁盘读取，频繁 streaming 状态更新成本受控。
- generation token、有限并发和 last-good snapshot 提供可测试的竞态与故障边界。

### 负面

- 首次展示需要读取每个 index entry 对应的 `.session`，成本高于只显示文件路径。
- Catalog、Runtime Registry、SessionStorage 和 vault 事件之间需要明确的订阅清理。
- 外部工具若只修改插件目录 index 而不产生 vault entry 事件，实时可见性依赖下一次 refresh；
  companion importer 必须继续按 entry + index 的发布顺序写入。
- 生命周期操作不做乐观更新，慢速 vault 上列表变化会等待权威事件，但避免虚假成功。

## 验证

本 ADR 不引入陌生库、协议或存储技术，属于现有 observer、Obsidian Vault API 和
`useSyncExternalStore` 模式的内部架构约定，无需 spike。可行性由
[AC-0005](../ac/0005-session-navigator.md) 验证：纯 Catalog fixtures、假时钟事件合并、
generation 竞态、文件故障注入、Runtime Registry 合并、Obsidian E2E 和视觉回归。

## 约束范围

`src/services/session-catalog.ts`、`src/services/view-registry.ts`、
`src/services/session-storage.ts`、`src/ui/SessionManagerView.tsx`、`src/ui/ChatPanel.tsx`、
plugin lifecycle 与对应测试。

## 约束规则

| 规则编号 | 规则 | 适用范围 | 违反时如何检出 |
|----------|------|----------|----------------|
| AR-010-01 | `.session` 是 Catalog 展示元数据的唯一权威来源；index 只用于发现和路径映射 | Catalog loader | AC-0018-N-2 + architecture test |
| AR-010-02 | Catalog 和 Runtime Registry 是内存投影，不得新增持久化副本 | `src/services/` | storage write spy + code review |
| AR-010-03 | React UI 只订阅 Catalog snapshot，不直接读取 index 或 `.session` | Session Navigator UI | import/architecture test |
| AR-010-04 | runtimeStatus 按 entryId + viewId 注册并按固定优先级合并 | Runtime Registry | AC-0019-B-2 单元测试 |
| AR-010-05 | entry/index refresh 使用有限并发、generation token 和 last-good snapshot | Catalog refresh | AC-0018-F-1 + race test |
| AR-010-06 | Runtime/选中态变化不得触发磁盘重读 | Catalog projection | read spy |
| AR-010-07 | 所有事件订阅由 plugin lifecycle 清理，关闭 Navigator 不销毁共享 Catalog | plugin + services | lifecycle test |
| AR-010-08 | 生命周期操作执行时按 entryId 重新解析最新 entryFile，不信任陈旧路径 | Navigator commands | AC-0020-E-1 + AC-0021-E-1 |
| AR-010-09 | Session Runtime Registry 不依赖 React、Obsidian view 子类或 ACP SDK 类型 | `src/services/view-registry.ts` | import-boundary test |
| AR-010-10 | 有效 entry 的 create/rename 通过 SessionStorage 幂等 reconciliation 维护唯一 index 映射；身份冲突不得自动覆盖 | plugin + SessionStorage | AC-0018-N-1 + conflict test |

## 与既有决策的关系

| 既有规则 | 处理 |
|----------|------|
| ADR-0003：`.session` 是 vault 中一等入口 | 保留；Catalog 只是导航投影 |
| ADR-0003：index 提供 Session 入口发现 | 保留；Catalog 从 index 构建候选集合 |
| ADR-0005：本地 transcript 是唯一权威历史 | 保留；Catalog 不读取或复制消息历史 |
| ADR-0005：运行时 UI 状态不作为持久化真相 | 保留；Runtime Registry 只存在于内存 |
