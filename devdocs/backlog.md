# Backlog

增量迭代需求池。状态使用 `candidate`、`planned`、`done`；进入 DESIGN 的需求必须先标记为 `planned` 并记录目标迭代。

| 编号 | 需求 | 状态 | 目标迭代 | 来源 |
|------|------|------|----------|------|
| BL-0001 | 将现有 SessionManagerView 升级为 Codex 风格的全局 Session 导航器：按 Projects 和 Recents 组织 Session，不设独立 Active 分区，在 Session 行右侧显示运行状态 | done | v0.5.0 | 2026-07-26 用户需求 |
| BL-0002 | 强化 Session Navigator 的视觉角色层级：静态 Projects/Recents 分区标题、可点击 Show more 操作与 Project/Session 行必须通过字号、颜色、字重和 hover 明确区分 | planned | v0.5.0 | 2026-07-26 用户视觉反馈 |
