---
title: Plan-01: JSONL 追加式 History 存储
description: 实现 sessions/{sessionId}/main.jsonl 追加式存储，每行一条原始 ACP SessionUpdate 事件。
type: plan
status: done
created: 2026-07-16T00:00:00Z
---

# Plan-01: JSONL 追加式 History 存储

## 目标

实现 AC-0003 全部场景：对话历史以追加式 JSONL 存储，首行元数据，后续行原始 ACP 事件。

## 实现步骤

1. `SessionStorage` 添加 JSONL 方法：`appendEvent()`, `ensureSessionDir()`, `readHistory()`
2. `AcpHandler` 添加 JSONL 写入 hook：每个 sessionUpdate 事件追加一行
3. `useSessionHistory` 添加 JSONL 读取：`loadHistoryFromJsonl()` 替代全量 JSON 文件
4. 移除或标记 deprecated 旧的 `saveSessionMessages` / `loadSessionMessages` (JSON 全量写入)

## Constraints

- 追加式写入，不重写整个文件
- 首行必须为元数据 (type: metadata)
- 事件格式与 `SessionUpdate` 类型一一对应
- 每次写入后 flush 到磁盘
- 读取时按需加载最近 N 条

## Checkpoint

- AC-0003-N-1: 发送消息后 main.jsonl 存在，首行元数据 + 事件行
- AC-0003-N-2: 第二条消息追加到末尾
- AC-0003-B-1: 首次对话创建目录和文件
- AC-0003-E-1: 损坏行不影响其他行读取
- AC-0003-F-1: 目录不可写时不崩溃