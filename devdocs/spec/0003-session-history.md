---
title: Spec-0003: Session 对话历史恢复
description: 打开 .session 文件时自动恢复对话历史，支持 JSONL 本地恢复和 ACP session/load 远程恢复。
type: spec
status: active
version: 1
created: 2026-07-17T00:00:00Z
---

# Spec-0003: Session 对话历史恢复

## 一、概述

当前打开 .session 文件时总是创建新的空白对话。本 Spec 实现对话历史自动恢复：
1. 从 JSONL 加载历史消息并显示
2. 尝试通过 ACP session/load 恢复远程 session
3. 恢复失败时降级为新的 ACP session + 本地历史

参考：[Spec-0001](../spec/0001-session-entry.md)、[ADR-0003](../adr/0003-session-entry.md)

## 二、用户故事

| 编号 | 角色 | 需求 | 目的 | 优先级 |
|------|------|------|------|--------|
| US-008 | 用户 | 打开 .session 文件时看到之前的对话历史 | 继续之前的对话，不丢失上下文 | P0 |
| US-009 | 用户 | 对话历史自动从 JSONL 恢复，无需手动操作 | 无缝体验，打开即用 | P0 |

## 三、实现方案

### 恢复策略（降级链）

```
1. 读取 .session → sessionId
2. 尝试 ACP session/load (agent 支持的远程恢复)
   → 成功: 从 agent 恢复完整状态
   → 失败: 降级到本地恢复
3. 本地恢复: 从 JSONL 读取历史，重建消息列表
4. 创建新的 ACP session (newSession)，但保留历史消息
```

### 数据流

```
HarnessSessionView.onLoadFile
  → 读取 .session → sessionId, agentId, cwd
  → ChatPanel (新增 sessionId prop)
    → useAgent 检测 sessionId
      → readHistory(sessionId) → 加载 JSONL
      → 转换为 ChatMessage[]
      → 尝试 session/load (ACP)
      → 成功: 使用 ACP 恢复的 session
      → 失败: newSession + 本地历史消息
```

## 四、模块变更

| 模块 | 变更 | 优先级 |
|------|------|--------|
| ChatPanel | 新增 `initialSessionId` prop | P0 |
| useAgent | 新增 history 恢复逻辑 | P0 |
| useAgentMessages | 支持从 JSONL 批量加载消息 | P0 |
| HarnessSessionView | 传递 sessionId 到 ChatPanel | P0 |

## 五、依赖

| 依赖 | 用途 |
|------|------|
| `session-storage.readHistory()` | 读取 JSONL 历史 |
| `AcpClient.loadSession()` | ACP session/load |
| 现有 `SessionUpdate` 类型 | JSONL 事件 → ChatMessage 转换 |