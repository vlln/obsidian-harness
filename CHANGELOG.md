# Changelog

项目版本变更记录，遵循 [Keep a Changelog](https://keepachangelog.com/) 规范。

---

## [Unreleased]

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