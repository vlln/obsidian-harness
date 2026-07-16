---
title: ADR-0003: Session 入口文件设计
description: Session 通过 vault note 文件作为入口点，而非统一的侧边栏 Session 列表。
type: adr
status: proposed
created: 2026-07-15T00:00:00Z
---

# ADR-0003: Session 入口文件设计

---

## 背景

当前 Session 的入口是统一的侧边栏 ChatView 或 SessionManagerView。Session 列表通过 SessionHistoryModal 集中展示。这与"笔记即控制台"的产品哲学不符——用户需要从 vault 中分散的 note 文件直接启动和管理 Session，而非通过中央面板。

Session 入口文件是一个 vault note，它逻辑上代表一个 Session。用户点击或打开该文件时，进入对话流界面。Session 入口文件可以分散在 vault 各处（如 `Projects/xxx/session-001.md`），被其他笔记引用，自然融入知识网络。

---

## 决策内容

**Session 入口文件是 vault 中的 markdown note，逻辑上代表一个 Session。插件通过 file-menu 和自定义 view type 提供从 note 启动 Session 的机制。**

---

## 备选方案

### 方案 A: Session 文件存储全量历史

Session 入口文件同时存储全部对话历史。每次对话更新时重写整个文件。

- 优点：一个文件包含所有内容，简单直观
- 缺点：大文件写入开销大、部分损坏影响整体、与 Obsidian 的自动同步冲突（文件被外部修改时）

### 方案 B: 入口文件 + 分离存储（选择）

Session 入口文件是轻量的"指针"——包含 session 元数据（sessionId、agentId、cwd、frontmatter），对话历史存储在独立的追加式存储中。入口文件可被 wikilink 引用，对话历史按需加载。

- 优点：入口文件轻量、写入开销小、可被图谱索引和 wikilink 引用、历史存储可独立优化（追加式、分卷、摘要）
- 缺点：两个文件需要保持一致性

### 方案 C: 纯内存 + 导出

Session 不持久化到 vault note，仅在内存中，手动导出为 Markdown。

- 优点：最简单
- 缺点：Session 不是一等公民，无法被引用、无法跨 session 恢复

---

## 选择理由

方案 B 在"Session 作为一等公民"和"存储效率"之间取得平衡。入口文件是轻量的 markdown note，可被 Obsidian 的 wikilink、图谱、搜索自然索引。对话历史使用追加式存储，为未来的分卷、摘要、跨设备优化预留空间。

---

## 验证

需通过 spike 原型验证：

| 验证项 | 复现步骤 | 结论 | 经验 | 验证 Branch |
|--------|---------|------|------|------------|
| 从 note 创建 session 入口 | 右键 note → "Start Agent Session" → 验证入口文件创建 | | | spike/0001-fs-entry-prototype |
| 入口文件打开对话界面 | 点击入口文件 → 验证对话流 UI 加载 | | | spike/0001-fs-entry-prototype |
| Agent 通过 ACP 读写 vault 文件 | 在对话中让 agent 读/写 vault 文件 → 验证内容正确 | | | spike/0001-fs-entry-prototype |
| 入口文件被 wikilink 引用 | 在另一笔记中 `[[session-001]]` → 验证链接可点击 | | | spike/0001-fs-entry-prototype |

---

## 后果

### 正面

- Session 融入 Obsidian 知识网络，可被引用、搜索、图谱展示
- 入口文件分散在 vault 中，自然支持以 Project 为单位的 Session 管理
- 轻量入口 + 分离存储为未来扩展（分卷、摘要、跨设备）预留空间

### 负面

- 需要实现新的 view type 和 file-menu 集成
- 入口文件与历史存储的一致性需要维护
- 与现有 ChatView 架构的兼容需要过渡期

---

## 约束范围

`ui/ChatView.tsx`、`ui/ChatPanel.tsx`、`services/session-storage.ts`、`types/session.ts`、`plugin.ts`

---

## 约束规则

| 规则编号 | 规则 | 适用范围 | 违反时如何检出 |
|----------|------|---------|--------------|
| AR-001 | Session 入口文件必须是有效的 Obsidian markdown note，包含 frontmatter | `session-storage.ts` | 文件解析失败 |
| AR-002 | 对话历史存储与入口文件分离，入口文件不包含全量历史 | `session-storage.ts` | code review |
| AR-003 | 入口文件可被 wikilink 引用，不依赖插件自定义语法 | vault note 格式 | 在 Obsidian 中测试 wikilink |
| AR-004 | Agent 的 fs read/write 通过 ACP 协议，不绕过 Obsidian vault API | `acp-handler.ts` | code review |

---

## 修订记录

| 日期 | 修订内容 | 修订原因 |
|------|---------|----------|
| | | |