---
title: Plan-03: .session 文件 Wikilink 集成
description: 验证并增强 .session 文件的 wikilink 支持，确保在笔记中可引用和跳转。
type: plan
status: done
created: 2026-07-16T00:00:00Z
---

# Plan-03: .session 文件 Wikilink 集成

## 目标

实现 US-003：在普通笔记中通过 wikilink 引用 Session，将 Session 融入知识网络。

## 分析

`registerExtensions(["session"], VIEW_TYPE_HARNESS_SESSION)` 已在 Plan-02 实现。Obsidian 的 wikilink 解析器使用相同的扩展名→视图映射，因此 `[[file.session]]` 应该已经原生支持：

1. **链接解析**: Obsidian 在 vault 中查找 `file.session`，找到后渲染为可点击链接
2. **点击跳转**: 触发 `openFile(file)`，调用 `HarnessSessionView.onLoadFile()`
3. **自动补全**: `[[` 触发文件搜索，包含所有扩展名的文件

## 实现步骤

### 1. 验证 wikilink 原生支持

- 创建 .session 文件
- 在笔记中写入 `[[session-xxx.session]]`
- 确认链接可点击，跳转到 HarnessSessionView

### 2. 增强（可选）

- 如果 `[[` 自动补全不包含 .session 文件，添加自定义 `MetadataCache` 解析器
- 如果 hover preview 需要自定义，实现 `getViewData()` 返回摘要

### 3. 文档

- 更新 Spec 和 AC 状态

## Constraints

- 不修改 Obsidian 内部链接解析器（使用原生 API）
- 不实现 embed 支持（`![[.session]]`），那是 P2 功能

## Checkpoint

- US-003-N-1: `[[session-xxx.session]]` 在阅读模式中渲染为可点击链接
- US-003-N-2: 点击链接打开 HarnessSessionView
- US-003-N-3: `[[` 自动补全包含 .session 文件