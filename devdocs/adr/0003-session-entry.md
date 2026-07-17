---
title: ADR-0003: Session 入口文件与存储设计
description: Session 以 .session 扩展名文件作为 vault 入口，history 以追加式 JSONL 存储原始 ACP 事件。
type: adr
status: accepted
created: 2026-07-15T00:00:00Z
---

# ADR-0003: Session 入口文件与存储设计

---

## 背景

当前 Session 的入口是统一的侧边栏 ChatView，Session 通过 SessionHistoryModal 集中管理。这与"笔记即控制台"的产品哲学不符。

Session 入口文件是一个独立的文件格式（`.session`），是 vault 中的一等公民。用户点击它进入对话界面，可在笔记中通过 wikilink 引用它。Session 分散在 vault 各处，自然支持以 Project 为单位的 Session 管理。

存储设计参考了现有 harness（kimi-code、pi、Claude Code）的实践：原始事件流以追加式 JSONL 存储，一条事件一行。

关键概念区分：
- **Session**：用户视角，一次完整对话。可能包含多个 agent 交互。
- **History**：单个 agent 的 ACP 生命周期，即一条 `main.jsonl`。

---

## 决策内容

**三层结构：`.session` 文件（vault 入口）→ `session_index.jsonl`（总索引）→ `sessions/{sessionId}/main.jsonl`（追加式 history）。**

---

## 三层结构

```
vault/
├── Projects/my-project/
│   ├── notes.md
│   └── refactor-auth.session        # 入口（元数据），几乎不改动

插件数据目录 (.obsidian/plugins/obsidian-harness/)
├── session_index.jsonl              # 索引 session（用户视角），非索引文件
└── sessions/
    └── {sessionId}/
        └── main.jsonl               # 追加式 history，原始 ACP 事件流
```

### `.session` 文件（vault，≈ state.json）

```json
{
  "version": 1,
  "sessionId": "abc123",
  "agentId": "claude-code-acp",
  "cwd": "/path/to/project",
  "title": "Refactor auth module",
  "createdAt": "2026-07-15T10:30:00Z",
  "updatedAt": "2026-07-15T14:00:00Z",
  "forkedFrom": null
}
```

轻量 JSON，不含历史。可被 Obsidian 文件浏览器识别，可被 wikilink 引用。点击打开时，插件渲染对话界面。

### `session_index.jsonl`（插件数据目录）

```jsonl
{"sessionId":"abc123","cwd":"/path/to/project","entryFile":"refactor-auth.session"}
```

JSONL 格式，一行一个 session。索引 session 的元信息，让插件能快速查找 session 而不需要扫描整个 vault。`sessions/` 目录本身可通过 `ls` 发现所有 session 目录。

### `sessions/{sessionId}/main.jsonl`（追加式 history）

```jsonl
{"type":"metadata","version":1,"sessionId":"abc123","agentId":"claude-code-acp","cwd":"/path/to/project","title":"Refactor auth","createdAt":"...","updatedAt":"..."}
{"type":"user_message_chunk","sessionId":"abc123","text":"Refactor the auth module"}
{"type":"agent_message_chunk","sessionId":"abc123","text":"I'll start by analyzing..."}
{"type":"tool_call","sessionId":"abc123","toolCallId":"t1","title":"Read","status":"completed","kind":"read","content":[...],"locations":[...]}
{"type":"agent_message_chunk","sessionId":"abc123","text":"Done."}
```

- 首行：元数据（session 的完整信息）
- 后续行：原始 ACP `SessionUpdate` 事件，事件来了就 append，不做任何转换
- 格式与 `types/session.ts` 的 12 种 `SessionUpdate` 类型一一对应
- 追加式写入：新事件不断往后写，无需重写整个文件。部分损坏不影响整体。按需加载（只读最近 N 条）
- `version` 字段预留格式演进
- 目录结构预留多 agent 扩展（`{sessionId}/` 下可放多个 `.jsonl`）

---

## 备选方案

### 方案 A: 单文件存储（全量 history 在 .session 中）

.session 文件同时包含元数据和全量历史。

- 优点：一个文件，简单
- 缺点：大文件写入开销大、每次对话更新需重写整个文件、与 Obsidian 文件同步冲突

### 方案 B: 三层结构（选择）

元数据、索引、历史分离。

- 优点：入口文件轻量、追加式写入低开销、部分损坏不影响整体、按需加载
- 缺点：需要维护三个文件的一致性

### 方案 C: 不持久化，仅内存

Session 不持久化，仅在内存中，手动导出。

- 优点：最简单
- 缺点：Session 不是一等公民，无法跨 session 恢复

---

## 选择理由

三层结构参考了现有 harness（kimi-code、pi、Claude Code）的实践，且已被验证可行。`.session` 文件作为 vault 入口让 Session 成为 Obsidian 知识网络的一等公民。JSONL 追加式存储是处理长对话历史的最优方式。

---

## 验证

| 验证项 | 复现步骤 | 结论 | 经验 | 验证 Branch |
|--------|---------|------|------|------------|
| 注册 .session 扩展名和自定义 view type | 在 plugin.ts 中注册 `registerExtensions` + `registerView` | **可行** | `registerExtensions(["session"], VIEW_TYPE)` + `FileView` 子类，Obsidian 实测点击 `.session` 打开自定义 view | spike/0001-session-entry |
| 创建 .session 文件 | 命令面板 → "Create new .session file" → 验证 JSON 文件写入 vault | **可行** | `app.vault.create()` + `openFile()`，实测文件创建成功 | spike/0001-session-entry |
| 点击 .session 打开对话界面 | 点击 .session 文件 → 验证对话 UI 加载，session 参数正确 | **可行** | `FileView.onLoadFile(file)` 原生 API 直接传入文件，ChatPanel 渲染成功，agentId/cwd 从 .session 文件读取 | spike/0001-session-entry |
| 追加式 JSONL 存储 | 发送消息 → 验证事件追加到 main.jsonl，不重写整个文件 | 待验证 | 需配置 Agent 并实际对话后才能验证 | — |
| wikilink 引用 | 在笔记中 `[[session-xxx.session]]` → 验证链接可点击 | 待验证 | 依赖 Obsidian 的 wikilink 解析，.session 文件在 vault 中应自动支持 | — |

---

## 后果

### 正面

- Session 融入 Obsidian 知识网络，可被引用、搜索、图谱展示
- 入口文件分散在 vault 中，自然支持以 Project 为单位的 Session 管理
- 追加式 JSONL 写入低开销，支持长对话历史
- 目录结构预留多 agent 扩展

### 负面

- 需要实现新的 view type 和 file-menu 集成
- 三层结构的文件一致性需要维护
- 与现有 ChatView 架构的兼容需要过渡期

---

## 约束范围

`plugin.ts`、`ui/ChatView.tsx`（新增 HarnessSessionView）、`services/session-storage.ts`、`types/session.ts`

---

## 约束规则

| 规则编号 | 规则 | 适用范围 | 违反时如何检出 |
|----------|------|---------|--------------|
| AR-001 | `.session` 文件使用 `.session` 扩展名，内容为 JSON，包含 version、sessionId、agentId、cwd、title | `plugin.ts` 注册 | 文件解析失败 |
| AR-002 | History 以追加式 JSONL 存储，每行一条原始 ACP SessionUpdate 事件，不做聚合转换 | `session-storage.ts` | code review |
| AR-003 | History 文件首行为元数据行（type: metadata） | `session-storage.ts` | 读取时校验首行 |
| AR-004 | Session 入口文件不包含 history 内容 | `.session` 文件格式 | code review |
| AR-005 | 入口文件可被 wikilink 引用 | vault 文件格式 | 在 Obsidian 中测试 |

---

## 修订记录

| 日期 | 修订内容 | 修订原因 |
|------|---------|----------|
| 2026-07-15 | 重写：从 markdown note 方案改为 .session 文件 + 三层结构 | 明确区分 Session 和 History，参考现有 harness 实践 |
| 2026-07-15 | 移除 fs read/write 验证项 | 所有 ACP 后端都不使用该接口，Agent 通过自己的工具操作文件 |
| 2026-07-15 | 补充 .session 文件格式和 session_index.jsonl 设计 | 设计细化 |
