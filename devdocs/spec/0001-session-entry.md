---
title: Spec-0001: Session 入口文件
description: Session 以 .session 文件作为 vault 入口，通过 FileView 自定义视图打开对话界面。
type: spec
status: active
version: 1
created: 2026-07-15T00:00:00Z
---

# Spec-0001: Session 入口文件

---

## 一、项目概述

本 Spec 定义 Obsidian Harness 的核心差异化功能：Session 入口文件。

区别于原项目（侧边栏 ChatView 为唯一入口），Session 以 `.session` 文件形式存在于 vault 中，可被文件浏览器管理、wikilink 引用、知识图谱索引。点击打开后渲染对话界面。

参考：[Vision](../vision.md)、[ADR-0003](../adr/0003-session-entry.md)

---

## 二、用户故事

| 编号 | 角色 | 需求 | 目的 | 优先级 |
|------|------|------|------|--------|
| US-001 | 用户 | 在 vault 中创建 Session 入口文件 | 从笔记系统管理 Agent 会话，而非依赖侧边栏 | P0 |
| US-002 | 用户 | 点击 .session 文件打开对话界面 | 通过文件浏览器直接进入 Agent 对话 | P0 |
| US-003 | 用户 | 在普通笔记中通过 wikilink 引用 Session | 将 Session 融入知识网络，形成双向链接 | P1 |
| US-004 | 用户 | 对话历史自动追加存储 | 不丢失对话上下文，支持长对话 | P0 |

---

## 三、模块划分

| 模块 | 提供的能力 | 目录路径 | 优先级 |
|------|-----------|---------|---------|
| Session 入口视图 | 注册 .session 扩展名、FileView 渲染 ChatPanel、读取 session 元数据 | `ui/HarnessSessionView.tsx` | P0 |
| Session 创建 | 创建 .session 文件、生成 sessionId、写入 JSON 元数据 | `plugin.ts` (createSessionFile/materializeSessionFile) | P0 |
| Session 索引 | session_index.jsonl 追加/删除、按 cwd 查询 | `services/session-storage.ts` (新增) | P0 |
| History 存储 | 追加式 JSONL 写入、按需读取、首行元数据校验 | `services/session-storage.ts` (新增) | P0 |
| 现有 ChatPanel 复用 | 对话 UI、消息渲染、Agent 连接、权限管理 | `ui/ChatPanel.tsx` | — |

---

## 四、数据模型

### .session 文件（vault 可见）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| version | number | 必填 | 格式版本，当前为 1 |
| sessionId | string | 必填 | UUID，关联 session_index.jsonl |
| agentId | string | 必填 | Agent 标识（claude-code-acp / pi-acp / ...） |
| cwd | string | 必填 | 工作目录，Agent 的 project root |
| title | string | 必填 | 会话标题 |
| createdAt | ISO 8601 | 必填 | 创建时间 |
| updatedAt | ISO 8601 | 必填 | 最后活跃时间 |
| forkedFrom | string \| null | 可选 | 分叉来源 sessionId |

### session_index.jsonl（插件目录）

每行一个 JSON 对象：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| sessionId | string | 必填 | 关联 .session 文件 |
| cwd | string | 必填 | 工作目录，用于按项目过滤 |
| entryFile | string | 必填 | vault 中 .session 文件的相对路径 |

### sessions/{sessionId}/main.jsonl（追加式 history）

首行元数据，后续行原始 ACP SessionUpdate 事件。详见 [ADR-0003](../adr/0003-session-entry.md)。

---

## 五、业务规则

| 规则编号 | 描述 | 触发条件 | 约束 |
|----------|------|----------|------|
| BR-001 | .session 文件创建时 sessionId 已生成，首次对话后不变 | 创建 .session 文件 | sessionId 不可变 |
| BR-002 | sessionId 不存在时，首次对话创建新 ACP session，回写 sessionId | 发送第一条消息 | sessionId 写入 .session 和索引 |
| BR-003 | 同一 cwd 下可有多个 .session 文件 | 创建多个 session | 无限制 |
| BR-004 | 删除 .session 文件时同步清理索引和 history | 删除 .session 文件 | 索引和 history 同步删除 |
| BR-005 | 所有可恢复 session 都有 .session 文件 | 打开任意 chat 入口 | 若未指定入口文件，创建默认 .session 后再启动 session |
| BR-006 | 未指定 cwd 时使用 vault 根目录 | 创建默认 .session | cwd 写入 vault 根目录 |
| BR-007 | 默认 .session 存放在可配置目录 | 创建默认 .session | 默认目录为 `Sessions` |

---

## 六、UI 约束

### 视图结构

```
HarnessSessionView (FileView)
├── ChatPanel (variant="sidebar")
│   ├── ChatHeader
│   ├── MessageList
│   └── InputArea
```

### 组件规范

- `HarnessSessionView` 继承 `FileView`，通过 `onLoadFile(file)` 获取 session 文件
- 复用现有 `ChatPanel`，传入 `workingDirectory`（cwd）和 `initialAgentId`（agentId）
- `ChatPanel` 内部自动处理 session 生命周期（initialize → newSession → sendPrompt）

---

## 七、非功能指标

| 维度 | 指标 | 目标值 |
|------|------|--------|
| 兼容性 | .session 文件可被 Obsidian wikilink 解析 | 点击可跳转 |
| 性能 | history 追加写入延迟 | < 50ms |
| 兼容性 | 文件格式向后兼容（version 字段） | 旧版本文件可被新版本读取 |

---

## 八、依赖项

| 依赖 | 用途 |
|------|------|
| Obsidian FileView API | .session 文件的自定义视图 |
| Obsidian registerExtensions | 注册 .session 扩展名 |
| 现有 ChatPanel | 对话界面渲染 |
| 现有 AcpClient | Agent 连接和 session 管理 |
| Node.js fs | JSONL 文件追加写入 |

---

## 九、术语表

| 术语 | 定义 |
|------|------|
| Session | 用户视角的一次完整对话，可能包含多个 agent 交互 |
| History | 单个 agent 的 ACP 生命周期，即 main.jsonl 中的事件流 |
| .session 文件 | vault 中的入口文件，包含 session 元数据 |
| session_index.jsonl | 插件目录中的 session 索引，映射 sessionId → cwd + 入口文件路径 |
