# Backlog

增量迭代需求池。状态使用 `candidate`、`planned`、`done`；进入 DESIGN 的需求必须先标记为 `planned` 并记录目标迭代。

| 编号 | 需求 | 状态 | 目标迭代 | 来源 |
|------|------|------|----------|------|
| BL-0001 | 将现有 SessionManagerView 升级为 Codex 风格的全局 Session 导航器：按 Projects 和 Recents 组织 Session，不设独立 Active 分区，在 Session 行右侧显示运行状态 | done | v0.4.0 | 2026-07-26 用户需求 |
| BL-0002 | 强化 Session Navigator 的视觉角色层级：静态 Projects/Recents 分区标题、可点击 Show more 操作与 Project/Session 行必须通过字号、颜色、字重和 hover 明确区分 | done | v0.4.0 | 2026-07-26 用户视觉反馈 |
| BL-0003 | 点击 Navigator 的 New session 时打开 Codex 风格创建弹窗：输入 Project name，可选择一个 Agent 工作目录；未选择时创建并使用 `~/Documents/<project-name>`，`.session` 入口仍保存在 vault，Project 继续由 `cwd` 投影而不新增独立项目实体 | done | v0.5.0 | 2026-07-26 用户需求 |
| BL-0005 | Session 打开后在消息区左缘显示 Codex 风格的 turn 导航轨道：每个节点对应一条用户消息，悬停可预览消息摘要，点击可平滑跳转到对应消息，滚动时高亮当前 turn；窄视图下不得遮挡消息内容 | done | v0.5.0 | 2026-07-26 用户需求 |
| BL-0006 | 精简 Navigator 行尾菜单：移除 Session 菜单中与点击行重复的 Open；为 Project 行增加菜单，提供 New session here、Open in system file manager 和 Copy path。Project 是 `cwd` 投影，不提供 Rename/Delete；系统文件管理器动作不得与 Session 的 Obsidian 文件树 Reveal 混淆 | done | v0.5.0 | 2026-07-26 用户需求 |
| BL-0007 | 更新 release workflow 使用的 pinned GitHub Actions，消除 Node 20 action runtime 弃用警告并验证 provenance/release 行为不变 | candidate | — | v0.5.0 发布复盘 |
| BL-0008 | 修复 Turn Navigator 的滚动同步：手动滚动消息区时更新当前 turn；回到底部按钮复用连续平滑滚动协调器，避免虚拟测量导致分段停顿 | done | v0.5.1 | 2026-07-27 用户反馈 |
| BL-0009 | 统一 Agent 配置模型并重组 Settings UI：所有后端（含内置）统一为单一 `agents[]` 数组模型（统一 AgentSettings 类型取代 Base/Claude/Codex/Gemini/Custom 五类型，含可选 apiKeySecretId 与 apiKeyEnvVarName），内置后端仅是预填默认值条目，消除 pi-acp 硬编码特例；Settings 页改为单一 Agents 分区 + 逐条编辑，合并三段重复的 built-in 渲染器。无老用户，不需要 data.json 迁移 | planned | v0.6.0 | 2026-07-28 用户需求 |
| BL-0010 | 将 Navigator 切换按钮放回左侧栏顶部：在 Session 视图 header 顶部提供打开/切换 Session Navigator 的按钮（早期版本曾在顶部，后移到 ribbon），恢复上下文就近入口；ribbon 图标保留 | planned | v0.6.0 | 2026-07-28 用户需求 |
| BL-0011 | 补齐 harness-session-importer Python 测试，恢复 `gate:mr` 覆盖率 ≥85%（d72f6f9 重写 importer.py 后跌至 81%，develop 门禁静默变红） | done | v0.6.0 | 2026-07-28 v0.6.0 TEST_INFRA 增量检查发现（工程债） |
