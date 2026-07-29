---
title: Report-0058-01: Navigator Toggle Button
description: Session 视图 sidebar header 的 Navigator 切换按钮已实现（BR-066/067），gate:mr 全绿；AC-0027 属 SYSTEM_TEST 层另容器交付。
type: report
status: complete
created: 2026-07-29T07:35:40Z
---

# Report-0058-01: Navigator Toggle Button

## 结论

Spec-0007 v3 §5.4/§6.4 落地。`.session` FileView 的 sidebar header 在 More 按钮之前新增
`panel-left` 图标按钮（aria-label `Open session navigator`），调用既有
`plugin.activateSessionManager()` 同一入口（BR-066）；floating 变体与旧 ChatView 不渲染
（BR-067，prop 仅存在于 sidebar 变体 props 中）。`npm run gate:mr` 全绿：
238 passed / 5 skipped。

关联 commit：`904914b`（`feat(session): 实现 BR-066/067 Session 视图 header 的 Navigator 切换按钮`）。

## 实现摘要（2 文件，+31/-1）

- `src/ui/ChatHeader.tsx`：`SidebarHeaderProps` 新增 `onOpenNavigator`；`SidebarHeader`
  在 More 按钮之前渲染 `NavActionButton`（`panel-left` / `Open session navigator`）。
  `NavActionButton` 补齐键盘可达性（role/tabIndex/Enter/Space 激活）——Spec §6.4 要求
  按钮可聚焦并键盘激活，同一组件的 More 按钮一并受益。
- `src/ui/ChatPanel.tsx`：新增 `handleOpenNavigator`——调用
  `plugin.activateSessionManager()` 并以 try/catch 包裹，失败时显示非阻断 Notice
  （Spec §七：Session 视图保持可用，不重复创建 leaf）；`handleShowSidebarMenu` 增加键盘
  激活的坐标回退（KeyboardEvent 无指针坐标时按按钮 bounding rect 定位菜单），避免
  NavActionButton 键盘化后 More 菜单错位。

## AC 验收

| AC 场景 | 结果 | 说明 |
|---------|------|------|
| AC-0027 全部（N-1/N-2/B-1/B-2/E-1/F-1） | 另容器交付 | WDIO E2E 属 SYSTEM_TEST 层（测试执行边界）；本分支交付被测实现与错误语义 |

## 偏差与说明

- Plan Checkpoint 未触发：两变体 props 为 discriminated union，`onOpenNavigator` 只加在
  sidebar 变体上，无公共结构重构。
- 计划外小改动：`NavActionButton` 键盘化与 More 菜单坐标回退——二者是 Spec §6.4 键盘
  激活要求的直接推论，且不改变鼠标路径行为。
