---
title: ADR-0002: ACP 层作为基础设施，复用边界
description: 定义从上游 Fork 的代码哪些保留不动、哪些可修改、哪些需重写。
type: adr
status: proposed
created: 2026-07-15T00:00:00Z
---

# ADR-0002: ACP 层复用边界

---

## 背景

Fork 自 RAIT-09/obsidian-agent-client 的代码分为三层：ACP 协议层（`acp/`）、类型层（`types/`）、服务层（`services/`）、UI 层（`ui/`、`hooks/`）。需要明确哪些层作为稳定基础设施保留，哪些层因产品哲学差异需重写。

---

## 决策内容

**`acp/` 和 `types/` 作为稳定基础设施，保持与上游兼容；`services/` 部分保留部分修改；`ui/` 和 `hooks/` 独立演进。**

---

## 复用边界

### 保留不动（稳定基础设施）

| 目录 | 理由 |
|------|------|
| `acp/acp-client.ts` | ACP 进程生命周期管理、JSON-RPC 通信，与产品形态无关 |
| `acp/acp-handler.ts` | SDK 事件接收、sessionId 过滤、listener 广播，与产品形态无关 |
| `acp/type-converter.ts` | ACP SDK ↔ 内部类型转换，与产品形态无关 |
| `acp/permission-handler.ts` | 权限队列、自动批准，与产品形态无关 |
| `acp/terminal-handler.ts` | 终端进程管理，与产品形态无关 |
| `types/` 全部 | 协议级类型定义，与产品形态无关 |
| `utils/` 全部 | 纯工具函数，与产品形态无关 |

### 保留但需修改

| 文件 | 修改内容 |
|------|---------|
| `acp/acp-handler.ts` | `readTextFile` / `writeTextFile` 从 stub 改为真实实现 |
| `acp/acp-client.ts` | `clientCapabilities.fs` 从 `false` 改为 `true` |
| `services/session-storage.ts` | Session 存储从插件隐藏目录改为 vault note 文件 |
| `services/session-helpers.ts` | 添加 note-entry 相关的 session 构建逻辑 |
| `types/session.ts` | `SavedSessionInfo` 添加 `sourceNote` 等入口文件关联字段 |
| `services/vault-service.ts` | 可能扩展以支持 Agent 文件读写 |

### 重写/大幅改造

| 目录/文件 | 理由 |
|------|------|
| `ui/ChatView.tsx` | 从 sidebar ItemView 改为从 note 文件入口触发的视图 |
| `ui/ChatPanel.tsx` | 需要支持 note-entry 模式 |
| `ui/SessionManagerView.tsx` | 集中式 session 列表不再适用，改为分散式入口 |
| `hooks/useSessionHistory.ts` | Session 列表从 cwd 过滤改为 note 关联过滤 |
| `hooks/useHistoryModal.ts` | Session 历史 modal 可能需要改为 note 内嵌视图 |

---

## 选择理由

ACP 协议层和类型层是经过验证的、与产品形态无关的基础设施。保留它们避免重复造轮子，同时在上层自由实现产品差异化。

---

## 验证

不适用（此 ADR 为边界定义，非技术选型）。

---

## 后果

### 正面

- 明确的分工边界，减少决策成本
- ACP 层稳定，可专注于上层改造

### 负面

- `services/` 层的修改需要谨慎，避免破坏与 ACP 层的兼容性
- 上游 `acp/` 的 bugfix 可能需要手动适配

---

## 约束范围

全部模块。

---

## 约束规则

| 规则编号 | 规则 | 适用范围 | 违反时如何检出 |
|----------|------|---------|--------------|
| AR-001 | `acp/` 和 `types/` 的修改仅限于启用已有但未实现的功能（如 fs read/write），不改变其接口 | `acp/`, `types/` | code review |
| AR-002 | `services/` 的接口保持不变，内部实现可改 | `services/` | 编译错误 |
| AR-003 | `ui/` 和 `hooks/` 自由改造，不要求与上游兼容 | `ui/`, `hooks/` | 无需检出 |

---

## 修订记录

| 日期 | 修订内容 | 修订原因 |
|------|---------|----------|
| | | |