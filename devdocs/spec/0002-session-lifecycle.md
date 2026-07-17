---
title: Spec-0002: Session 生命周期管理
description: Session 文件的删除清理、索引查询、SessionManagerView 展示。
type: spec
status: active
version: 1
created: 2026-07-17T00:00:00Z
---

# Spec-0002: Session 生命周期管理

## 一、项目概述

本 Spec 定义 Session 入口文件的生命周期管理能力。Spec-0001 实现了创建和打开，本 Spec 补全删除和列表展示。

参考：[Vision](../vision.md)、[Spec-0001](../spec/0001-session-entry.md)、[ADR-0003](../adr/0003-session-entry.md)

## 二、用户故事

| 编号 | 角色 | 需求 | 目的 | 优先级 |
|------|------|------|------|--------|
| US-005 | 用户 | 删除 .session 文件时自动清理索引和 history | 避免残留数据，保持存储整洁 | P0 |
| US-006 | 用户 | 在 SessionManagerView 中查看按 cwd 分组的 session 列表 | 快速定位和管理项目 session | P1 |
| US-007 | 用户 | 从 SessionManagerView 打开已有 session | 不需要在文件浏览器中找 .session 文件 | P1 |

## 三、模块划分

| 模块 | 提供的能力 | 目录路径 | 优先级 |
|------|-----------|---------|---------|
| Session 删除清理 | 监听 .session 文件删除事件，级联删除 session_index 条目和 history 目录 | `plugin.ts` + `services/session-storage.ts` | P0 |
| Session 列表查询 | 读取 session_index.jsonl，按 cwd 分组，返回可用 session 列表 | `services/session-storage.ts` (已有 `getSessionIndex`) | P0 |
| SessionManagerView 改造 | 展示 session 列表（按 cwd 分组），点击打开对应 session | `ui/SessionManagerView.tsx` | P1 |

## 四、业务规则

| 规则编号 | 描述 | 触发条件 | 约束 |
|----------|------|----------|------|
| BR-004 | 删除 .session 文件时同步删除 session_index 条目和 history 目录 | vault 中 .session 文件被删除（用户删除或外部删除） | 索引和 history 同步删除，删除失败不影响 Obsidian 正常运行 |
| BR-005 | SessionManagerView 展示所有 session_index 条目，按 cwd 分组 | 打开 SessionManagerView | 数据来源为 session_index.jsonl，非 vault 扫描 |
| BR-006 | 点击 SessionManagerView 中的条目 → 打开对应 .session 文件 | 用户点击列表项 | 如果 .session 文件已被删除，显示提示并清理索引 |

## 五、依赖项

| 依赖 | 用途 |
|------|------|
| Obsidian `vault.on("delete")` | 监听文件删除事件 |
| 现有 `session-storage.ts` | `getSessionIndex`, `removeSessionIndex`, `deleteHistory` |
| 现有 `SessionManagerView.tsx` | 改造为 session 列表展示 |
| 现有 `HarnessSessionView` | 打开 .session 文件 |