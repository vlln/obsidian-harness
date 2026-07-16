---
title: Plan-02: Session 入口文件创建与打开
description: 生产化 HarnessSessionView + createSessionFile + session_index.jsonl 管理，覆盖 AC-0001 和 AC-0002 全部场景。
type: plan
status: pending
created: 2026-07-16T00:00:00Z
---

# Plan-02: Session 入口文件创建与打开

## 目标

实现 US-001（Session 文件创建）和 US-002（FileView 打开），覆盖 AC-0001 和 AC-0002 全部场景。同时实现 session_index.jsonl 索引管理。

## 实现步骤

### 1. SessionFileData 类型定义

- 在 `types/session.ts` 中新增 `SessionFileData` 接口
- 字段：version, sessionId, agentId, cwd, title, createdAt, updatedAt, forkedFrom

### 2. Session 索引管理（session_index.jsonl）

在 `SessionStorage` 中新增:
- `appendSessionIndex(sessionId, cwd, entryFile)` — 追加一行 JSON
- `removeSessionIndex(sessionId)` — 删除一行（重写文件）
- `getSessionIndex(cwd?)` — 按 cwd 查询，返回索引条目列表
- `removeSessionIndex(sessionId)` — 删除对应条目

session_index.jsonl 每行格式:
```json
{"sessionId": "...", "cwd": "...", "entryFile": "..."}
```

### 3. HarnessSessionView 生产化

从 spike 移植并增强:
- 导入 `SessionFileData` 类型（从 types/）
- 错误处理：JSON 解析失败、agentId 不存在、agent 启动失败
- `onClose` 中清理 AcpClient 和 VaultService
- 使用 `crypto.randomUUID()` 生成 viewId

### 4. createSessionFile 命令生产化

从 spike 移植并增强:
- 生成 sessionId (UUID)
- 写入 .session 文件到 vault
- 追加 session_index.jsonl 条目
- 同名文件检测（AC-0001-B-1）
- 错误处理（vault 不可写 AC-0001-E-1）

### 5. registerExtensions 注册

- 注册 `.session` 扩展名 → HarnessSessionView
- 注册 HarnessSessionView 视图类型

### 6. 单元测试

- `test/session-storage.test.ts`: session_index 追加/删除/查询
- `test/session-file.test.ts`: SessionFileData 验证

## Constraints

- 不修改 `ChatPanel` 或 `AcpClient` 核心逻辑
- session_index.jsonl 追加写入，删除时重写
- .session 文件 JSON 格式，version 字段向后兼容
- HarnessSessionView 复用 ChatPanel 现有渲染

## Checkpoint

- AC-0001-N-1: vault 根目录下生成 session-{uuid}.session，内容为合法 JSON
- AC-0001-N-2: agentId 为 defaultAgentId，cwd 为 vault 路径
- AC-0001-B-1: 同名文件存在时 Notice 提示，不覆盖
- AC-0001-B-2: sessionId 为 36 字符 UUID
- AC-0002-N-1: 点击 .session 文件打开 ChatPanel
- AC-0002-N-2: agentId 对应 agent 初始化
- AC-0002-B-1: 空文件显示错误提示
- AC-0002-B-2: JSON 格式错误显示错误提示