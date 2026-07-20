# Changelog

项目版本变更记录，遵循 [Keep a Changelog](https://keepachangelog.com/) 规范。

---

## [Unreleased]

## [0.2.0] — 2026-07-20

### Added
- **Vault-native session entries**: Every sidebar, floating, and file-explorer session is represented by a linkable `.session` file.
- **Unified session persistence**: Session metadata, indexes, and JSONL transcripts now follow one storage path across all chat entry points.
- **Agent workbench UI**: Added thought duration, collapsible tool details, aligned copy actions, and richer composer resource affordances.
- **ACP configuration controls**: Added lazy-loaded model configuration, grouped model menus, current-model visibility, and usage display.
- **Session creation workflow**: Added the file-explorer New session command and configurable default session folder.

### Changed
- **Deferred agent startup**: Opening a session no longer starts the ACP backend until the first message is sent.
- **Backend-neutral lifecycle**: Session entry and persistence behavior now rely on ACP capabilities instead of backend-specific assumptions.
- **Prompt behavior**: Removed automatic Obsidian note injection so session context remains explicit.

### Fixed
- **Session restoration**: Hardened `session/load` replay, agent identity persistence, and backend session ID lifecycle handling.
- **Workbench consistency**: Fixed model menu visibility, message copy placement, tool-call rendering, and floating-session materialization.
- **Release metadata**: Version updates now always add the released plugin version to `versions.json`.

## [0.1.1] — 2026-07-17

### Added
- **pi-acp 自动发现**: 检测 `~/.pi/pi-acp/` 目录，自动添加到 Agent 列表
- **Session 删除清理**: 删除 .session 文件时级联删除 session_index 和 history
- **SessionManagerView 集成**: 展示 session_index 中的已保存 session，按 cwd 分组

### Fixed
- **macOS shell**: 使用 `-i -l`（interactive login shell）替代 `-l`，确保 `.zshrc` 中的 PATH 可用
- **React root 内存泄漏**: FileView `onLoadFile` 重复调用时先 unmount 旧 root

### Added
- Fork from [RAIT-09/obsidian-agent-client](https://github.com/RAIT-09/obsidian-agent-client) v0.11.0
- 建立独立产品身份：Obsidian Harness
- 接入 devloop 开发系统

---

## [0.1.0] — 2026-07-17

### Added
- **Session 入口文件** (.session): vault 中创建、FileView 打开、ChatPanel 渲染
- **JSONL 追加式 History**: sessions/{sessionId}/main.jsonl 追加式事件存储
- **session_index.jsonl**: session 索引管理（按 cwd 查询）
- **Wikilink 集成**: `[[file.session]]` 原生支持（registerExtensions）
- **E2E 测试**: WebDriverIO v9 + obsidian-launcher patch + 5 个 E2E 测试
- **单元测试**: 66 个测试 (platform + session-storage)
- **devloop 开发系统**: 完整文档体系（Vision, Spec, AC, ADR, Plan, Report）

### Changed
- 项目名称: obsidian-agent-client → obsidian-harness
- Session 存储: data.json 内嵌 → .session 文件 + JSONL
- 插件目录: agent-client → obsidian-harness

### Fixed
- React root 在 FileView onLoadFile 重复调用时的内存泄漏
