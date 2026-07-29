---
title: Plan-0058-01: Navigator Toggle Button
description: 在 .session FileView 的 sidebar header 增加 Navigator 切换按钮（Spec-0007 v3 §5.4/§6.4，BR-066/067，BL-0010）。
type: plan
status: done
created: 2026-07-29T05:12:23Z
---

# Plan-0058-01: Navigator Toggle Button

## Context

v0.6.0 增量需求 BL-0010。打开 Session Navigator 的 GUI 入口目前只有 Obsidian ribbon
（`src/plugin.ts` `addRibbonIcon` → `activateSessionManager`）。Spec-0007 v3 §5.4/§6.4
要求在 `.session` FileView 的 sidebar header 顶部恢复切换按钮：复用
`plugin.activateSessionManager()` 同一入口（BR-066），只在 sidebar 变体渲染（BR-067），
ribbon 保留。按钮规范：位于 More 按钮之前，`panel-left` 图标，aria-label/tooltip 为
`Open session navigator`，复用既有 `NavActionButton`/`nav-action-button` 模式。
异常语义（Spec §七）：激活失败时显示非阻断 Notice，Session 视图保持可用，不重复创建 leaf。

现状代码：`src/ui/ChatHeader.tsx` `SidebarHeader`（props: agentLabel/isUpdateAvailable/
onShowMenu，渲染 `nav-buttons-container` 内 title + More 按钮）；`src/ui/ChatPanel.tsx:1034`
sidebar 分支渲染 ChatHeader；`plugin.activateSessionManager`（src/plugin.ts:515）已实现
"有 leaf 则 reveal、无则创建"。

## Request

1. `ChatHeader.tsx`：`SidebarHeaderProps` 增加 `onOpenNavigator` 回调；`SidebarHeader`
   在 More 按钮之前渲染 `NavActionButton`（icon `panel-left`，label `Open session navigator`）。
2. `ChatPanel.tsx` sidebar 分支：传入 `onOpenNavigator`，内部调用
   `plugin.activateSessionManager()` 并以 try/catch 包裹，失败时显示非阻断 Notice
   （含"无法打开 Session Navigator"语义），不阻断 Session 视图。
3. floating 变体与旧 ChatView 不渲染该按钮（BR-067——只需不传 prop 或按 variant 条件渲染，
   以最贴合现有代码结构的方式实现）。

## Output Format

- `src/ui/ChatHeader.tsx` 与 `src/ui/ChatPanel.tsx` 变更
- `npm run gate:mr` 全绿
- Report：实现摘要、BR-066/067 落实说明；AC-0027 标注"SYSTEM_TEST 层，另容器交付"

## Constraints

- 不修改 `activateSessionManager` 本身与 ribbon 注册；不新增第二套打开逻辑（BR-066）。
- 按钮出现/消失不得改变 header 中 Agent 标签与 More 按钮布局（Spec §6.4）。
- 不修改已 active 的 Spec/AC/ADR；不写 AC-0027 的 WDIO 用例（测试执行边界）。
- 代码与文档分开 commit；分支 `feat/0058-navigator-toggle-button`。

## Checkpoint

若 sidebar/floating 两变体共用 props 导致条件渲染需要重构 ChatHeader 公共结构，
停止并上报，不做超出按钮本身的重构。

## Steps

1. 创建分支 `feat/0058-navigator-toggle-button`。
2. 实现 ChatHeader 按钮与 ChatPanel 接线（含失败 Notice）。
3. `npm run gate:mr` 全绿。
4. Report + 容器 README 状态表，分开 commit。
