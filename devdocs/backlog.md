# Backlog

增量迭代需求池。状态使用 `candidate`、`planned`、`done`；进入 DESIGN 的需求必须先标记为 `planned` 并记录目标迭代。

| 编号 | 需求 | 状态 | 目标迭代 | 来源 |
|------|------|------|----------|------|
| BL-0001 | 将现有 SessionManagerView 升级为 Codex 风格的全局 Session 导航器：按 Projects 和 Recents 组织 Session，不设独立 Active 分区，在 Session 行右侧显示运行状态 | done | v0.4.0 | 2026-07-26 用户需求 |
| BL-0002 | 强化 Session Navigator 的视觉角色层级：静态 Projects/Recents 分区标题、可点击 Show more 操作与 Project/Session 行必须通过字号、颜色、字重和 hover 明确区分 | done | v0.4.0 | 2026-07-26 用户视觉反馈 |
| BL-0003 | 点击 Navigator 的 New session 时打开 Codex 风格创建弹窗：输入 Project name，可选择一个 Agent 工作目录；未选择时创建并使用 `~/Documents/<project-name>`，`.session` 入口仍保存在 vault，Project 继续由 `cwd` 投影而不新增独立项目实体 | candidate | — | 2026-07-26 用户需求 |
| BL-0004 | 修复插件热更新后始终显示 `Plugin update available!`：更新检查不得把 Obsidian 内存中缓存的旧 manifest 版本当作当前运行构建版本；当前版本等于或高于公开 latest 时必须清除提示 | candidate | — | 2026-07-26 用户缺陷反馈 + Agent 诊断 |
| BL-0005 | Session 打开后在消息区左缘显示 Codex 风格的 turn 导航轨道：每个节点对应一条用户消息，悬停可预览消息摘要，点击可平滑跳转到对应消息，滚动时高亮当前 turn；窄视图下不得遮挡消息内容 | candidate | — | 2026-07-26 用户需求 |
