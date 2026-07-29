# Changelog

项目版本变更记录，遵循 [Keep a Changelog](https://keepachangelog.com/) 规范。

---

## [Unreleased]

## [0.6.0] — 2026-07-29

### Added
- **Navigator toggle in the Session header**: Open `.session` workspaces now show a `panel-left` button before the More menu that opens or reveals the Session Navigator through the same action as the ribbon icon and the `open-session-manager` command, with full keyboard support.
- **Unified Agents settings section**: A single section edits every backend — built-in or user-added — with the same per-entry fields: Agent ID, display name, path with auto-detect, arguments, optional API key, API key env var name, and environment variables. Any entry can be added or deleted, including the built-in defaults.
- **Optional API key injection**: Each agent entry can reference a key stored in Obsidian's Keychain (`apiKeySecretId`) plus the environment variable name to inject it as when spawning the backend. Keys are never written to `data.json`.

### Changed
- **Unified agent configuration model**: All backends now live in a single `agents[]` array. Built-in backends are simply prefilled entries, and the previous `claude`/`codex`/`gemini`/`customAgents` settings fields are ignored (no migration; no existing users to preserve).

### Fixed
- **Navigator toggle scope**: The legacy chat view no longer renders the Session header's Navigator toggle; it remains exclusive to `.session` FileViews.

## [0.5.1] — 2026-07-27

### Fixed
- **Turn viewport synchronization**: Manual message scrolling now updates the active Turn from the visible viewport, including after a restored transcript replaces the initial empty view.
- **Continuous bottom scrolling**: The scroll-to-bottom command now uses the same bounded smooth-scroll coordinator as Turn navigation, without pausing at intermediate user messages or exposing transient active states.

## [0.5.0] — 2026-07-26

### Added
- **Project-aware Session creation**: New session now opens a Codex-style modal with a project name and one optional Agent working directory, defaulting to `~/Documents/<project-name>` when no folder is selected.
- **Turn Navigator**: Open Session workspaces show one left-edge navigation node per user message, with preview tooltips, active-turn tracking and direct message navigation.
- **Project actions**: Project rows now provide New session here, Open in system file manager and Copy path commands.

### Changed
- **Focused Session actions**: Removed the redundant Open command from Session row menus while retaining row-click navigation and Obsidian Reveal for Session entry files.
- **Responsive Turn layout**: Turn nodes remain visible from 520 px upward and yield the full message viewport at narrower widths.

### Fixed
- **Turn accessibility names**: Preserved each Turn ordinal and preview in its accessible name after Obsidian tooltip registration.
- **Narrow Session workspace layout**: Prevented hidden Turn rails from collapsing message content into an implicit grid column.
- **Turn rail visual isolation**: Removed Obsidian host button chrome, hid independent long-rail scrollbars and kept distant active markers visible without affecting message scrolling.
- **Continuous Turn navigation**: Prevented dynamic virtual-message measurement from repeatedly restarting long-distance smooth scrolling.

## [0.4.0] — 2026-07-26

### Added
- **Global Session Navigator**: Added a Codex-style sidebar that discovers vault sessions through the shared Catalog and organizes them into Projects and Recents without a separate Active section.
- **Session search and lifecycle commands**: Added cross-field Session search, independent Show more controls, Project expansion, New session, and Open, Reveal, Rename, and Delete actions.
- **Inline runtime status**: Session rows now reserve a stable right-side status slot for ready, working, permission, error, and disconnected states.

### Changed
- **Single sidebar entry point**: The left ribbon Session Manager action replaces Open Chat Client, and the duplicate workspace-tab button has been removed.
- **Navigator visual hierarchy**: Projects and Recents are quiet static labels, Show more is a distinct compact command, and Project/Session rows retain stronger selectable-row typography across narrow and wide sidebars.

### Fixed
- **Obsidian button-theme compatibility**: Scoped Navigator selectors preserve left alignment, muted command styling, row geometry, and hover behavior when host or third-party themes override default button and text roles.

## [0.3.0] — 2026-07-20

### Added
- **Semantic turn transcripts**: Persist complete prompts, assistant messages, tool activity, plans, usage, stop reasons, and interrupted turns instead of token-level streaming events.
- **Offline-first session history**: Opening a `.session` renders its local transcript before any ACP process is initialized, even when the original working directory is unavailable.
- **Explicit continuation workspace**: Added read-only, ready-to-continue, connecting, connected, and backend-unavailable states with separate Continue and Start session actions.
- **Crash-resilient persistence**: Added atomic active-turn checkpoints, corrupt-record diagnostics, retryable persistence errors, and content-addressed blobs for large tool output.

### Changed
- **Version 2 session entries**: Session entry identity, local history identity, and optional opaque ACP binding are now independent and stable.
- **Continuation behavior**: Opening a session never automatically loads, resumes, or creates an ACP session; continuation requires an explicit user action.
- **History representation**: Local transcript storage is now the single authoritative semantic history and no longer preserves streaming chunk timing.

### Removed
- **Development v1 compatibility**: Removed v1 `.session` and raw `SessionUpdate` history readers, migration paths, and legacy projection. Development v1 sessions must be recreated.

### Fixed
- **Restore isolation**: Failed restoration preserves visible local history and all identities and can never silently fall back to a new ACP session.
- **Storage failure visibility**: Missing or corrupt transcripts and blobs, plus checkpoint and commit failures, now remain visible in the session workspace.

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
