# Obsidian Harness — LLM Developer Guide

## 一、项目简介

Obsidian Harness — 以 Obsidian 知识库为驾驶舱的 AI Agent 管理平台。通过 ACP 协议连接 Claude Code、Codex、Gemini CLI 等 Coding Agent，将 vault note 作为 Agent Session 的入口和控制平面。

- **产品哲学**: 笔记即控制台，Agent 即执行引擎，ACP 即通用协议
- **技术栈**: React 19, TypeScript, Obsidian API, Agent Client Protocol (ACP)
- **Forked from**: [RAIT-09/obsidian-agent-client](https://github.com/RAIT-09/obsidian-agent-client) v0.11.0

---

## 二、文档体系

| 文档 | 用途 |
|------|------|
| 本文档（AGENTS.md） | 项目入口地图 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 编码/Commit/文档/测试规范 |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录（Keep a Changelog） |
| [devdocs/vision.md](devdocs/vision.md) | 全局顶层愿景：业务目标、用户范围、长期理想形态 |
| [devdocs/spec/](devdocs/spec/) | Spec：需求规格。用户故事、模块划分、数据模型 |
| [devdocs/interface/](devdocs/interface/) | 接口定义 |
| [devdocs/ac/](devdocs/ac/) | 验收标准（AC）：正常/边界/异常/失败四场景 |
| [devdocs/adr/](devdocs/adr/) | 架构决策记录：技术选型、方案对比、取舍 |
| [devdocs/plans/](devdocs/plans/) | 执行容器：对应一个 Git 分支 |
| [devdocs/README.md](devdocs/README.md) | 子目录索引 + 当前系统状态 |
| [docs/](docs/) | 用户文档（Vitepress 站点） |

### 文档目录结构

```
├── AGENTS.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── devdocs/                  # 开发文档（devloop）
│   ├── README.md
│   ├── vision.md
│   ├── spec/
│   ├── interface/
│   ├── ac/
│   ├── adr/
│   └── plans/
├── docs/                     # 用户文档（Vitepress）
│   ├── index.md
│   ├── agent-setup/
│   ├── getting-started/
│   └── ...
├── src/
└── .github/workflows/
```

---

## 三、架构概览

```
src/
├── types/                       # Type definitions (no logic, no dependencies)
│   ├── chat.ts                  # ChatMessage, MessageContent, PromptContent, AttachedFile, ActivePermission
│   ├── session.ts               # ChatSession, SessionUpdate (12-type union), SessionInfo, Capabilities
│   ├── agent.ts                 # AgentConfig, agent settings (Claude/Codex/Gemini/Custom)
│   └── errors.ts                # AcpError, ProcessError, ErrorInfo
├── acp/                         # ACP protocol (SDK dependency confined here)
│   ├── acp-client.ts            # Process lifecycle, UI-facing API (AcpClient class)
│   ├── acp-handler.ts           # SDK event handler + sessionId filter + listener broadcast
│   ├── type-converter.ts        # ACP SDK ↔ internal type conversion
│   ├── permission-handler.ts    # Permission queue, auto-approve, Promise resolution
│   └── terminal-handler.ts      # Terminal process create/output/kill
├── services/                    # Business logic (non-React, no React imports)
│   ├── vault-service.ts         # Vault access + fuzzy search + CM6 selection tracking
│   ├── settings-service.ts      # Reactive settings store (observer pattern only)
│   ├── session-storage.ts       # Session metadata + message file I/O
│   ├── settings-normalizer.ts   # Settings validation helpers
│   ├── session-helpers.ts       # Agent config building, API key injection (pure functions)
│   ├── session-state.ts         # Session state updates (legacy mode/model, config restore)
│   ├── message-state.ts         # Message array transforms (upsert, merge, streaming apply)
│   ├── message-sender.ts        # Prompt preparation + sending (pure functions)
│   ├── chat-exporter.ts         # Markdown export with frontmatter
│   ├── view-registry.ts         # Multi-view management, focus, broadcast
│   └── update-checker.ts        # Agent/plugin version checking
├── hooks/                       # React custom hooks (state + logic)
│   ├── useAgent.ts              # Facade: composes useAgentSession + useAgentMessages
│   ├── useAgentSession.ts       # Session lifecycle, config options, optimistic updates
│   ├── useAgentMessages.ts      # Message state, streaming (RAF batch), permissions
│   ├── useSuggestions.ts        # @[[note]] mentions + /command suggestions (unified)
│   ├── useSessionHistory.ts     # Session list/load/resume/fork
│   ├── useChatActions.ts        # Business callbacks (send, newChat, export, restart, etc.)
│   ├── useHistoryModal.ts       # Session history modal lifecycle
│   └── useSettings.ts           # Settings subscription (useSyncExternalStore)
├── ui/                          # React components
│   ├── ChatContext.ts           # React Context
│   ├── ChatPanel.tsx            # Orchestrator: calls hooks, workspace events, rendering
│   ├── ChatView.tsx             # Sidebar view (ItemView wrapper)
│   ├── FloatingChatView.tsx     # Floating window
│   ├── ChatHeader.tsx           # Header
│   ├── MessageList.tsx          # Virtualized message list
│   ├── MessageBubble.tsx        # Single message rendering
│   ├── ToolCallBlock.tsx        # Tool call + diff display
│   ├── TerminalBlock.tsx        # Terminal output polling
│   ├── InputArea.tsx            # Textarea, attachments, mentions, history
│   ├── InputToolbar.tsx         # Config/mode/model selectors, usage, send button
│   ├── SuggestionPopup.tsx      # Mention/command dropdown
│   ├── PermissionBanner.tsx     # Permission request buttons
│   ├── ErrorBanner.tsx          # Error/notification overlay
│   ├── SessionHistoryModal.tsx  # Session history modal
│   ├── FloatingButton.tsx       # Draggable launch button
│   ├── SettingsTab.ts           # Plugin settings UI
│   ├── view-host.ts             # IChatViewHost interface
│   └── shared/
│       ├── IconButton.tsx
│       ├── MarkdownRenderer.tsx
│       └── AttachmentStrip.tsx
├── utils/                       # Shared utilities (pure functions)
│   ├── platform.ts              # Shell, WSL, Windows env, command building
│   ├── paths.ts                 # Path resolution, file:// URI
│   ├── error-utils.ts           # ACP error conversion
│   ├── mention-parser.ts        # @[[note]] detection/extraction
│   └── logger.ts                # Debug-mode logger
├── plugin.ts                    # Obsidian plugin lifecycle, settings persistence
└── main.ts                      # Entry point
```

## 四、数据流

### ACP Event Flow (single path)
```
Agent Process → ACP SDK → AcpHandler (sessionId filter) → listeners broadcast
  → useAgentSession (session-level: commands, mode, config, usage, error)
  → useAgentMessages (message-level: text chunks, tool calls, plan)
  → useAgent (facade, 1 onSessionUpdate subscription)
```

### Permission Flow
```
Agent requestPermission → PermissionManager.request() → onSessionUpdate (tool_call)
User clicks approve/reject → PermissionManager.respond() → onSessionUpdate (tool_call_update)
```

## 五、关键组件

### ChatPanel (`ui/ChatPanel.tsx`)
Central orchestrator component.
- **Hook Composition**: Calls useAgent, useSuggestions, useSessionHistory, useChatActions, useHistoryModal, useSettings
- **Workspace Events**: Handles hotkeys via ref pattern
- **Callback Registration**: IChatViewContainer callbacks via refs
- **Rendering**: Renders ChatHeader, MessageList, InputArea directly

### ACP Client (`acp/acp-client.ts`) + ACP Handler (`acp/acp-handler.ts`)

**AcpClient** — UI-facing API and process lifecycle:
- spawn() with login shell, JSON-RPC via ndJsonStream
- initialize() → newSession() → sendPrompt() → cancel() → disconnect()
- Session management: listSessions, loadSession, resumeSession, forkSession
- Owns PermissionManager, TerminalManager, AcpHandler

**AcpHandler** — SDK event receiver:
- sessionUpdate: converts ACP types → domain types → broadcast to listeners
- sessionId filter: only emits updates matching `currentSessionId`
- requestPermission → PermissionManager
- Terminal operations → TerminalManager

### Hooks

**useAgent** (facade): Composes useAgentSession + useAgentMessages. Single `onSessionUpdate` subscription, `useMemo`-wrapped return.

**useAgentSession**: Session lifecycle, config options, optimistic updates, session-level update handler.

**useAgentMessages**: Messaging, streaming (RAF batching), permissions, tool call index (O(1) upsert).

**useSuggestions**: @mention + /command unified, `useMemo`-wrapped return.

**useChatActions**: Business callbacks with individual method deps for stability.

**useSessionHistory**: Session list/load/resume/fork with 5-minute cache. `useMemo`-wrapped return.

### Services

**VaultService**: Vault access + file index + fuzzy search + CM6 selection tracking
**SettingsService**: Reactive settings store (observer pattern). Session storage delegated to SessionStorage.
**SessionStorage**: Session metadata CRUD + message file I/O
**session-helpers**: Pure functions — buildAgentConfigWithApiKey, findAgentSettings, getAvailableAgents
**session-state**: Pure functions — applyLegacyValue, tryRestoreConfigOption, restoreLegacyConfig
**message-state**: Pure functions — applySingleUpdate, applyUpsertToolCall, mergeToolCallContent
**message-sender**: Pure functions — preparePrompt (embedded context vs XML text), sendPreparedPrompt (auth retry)

## 六、开发规则

### 架构原则
1. **useAgent as facade**: ChatPanel calls useAgent, not sub-hooks directly.
2. **Services have zero React imports**: Pure functions and classes in `services/`.
3. **ACP isolation**: All `@agentclientprotocol/sdk` imports confined to `acp/`.
4. **Types have zero deps**: No `obsidian`, no SDK, no React in `types/`.
5. **Single event channel**: All agent events flow through `onSessionUpdate`.
6. **Context for services**: plugin, acpClient, vaultService, settingsService via ChatContext.

### 性能模式
1. **useMemo for return stability**: useAgent, useSuggestions, useSessionHistory
2. **sessionRef pattern**: useAgentSession stores session in useRef
3. **Individual method deps**: useChatActions uses `agent.sendMessage` not `agent`
4. **Workspace event refs**: ChatPanel stores handler callbacks in refs
5. **RAF batching**: useAgentMessages batches streaming updates per animation frame
6. **React.memo**: MessageBubble, ToolCallBlock, TerminalBlock
7. **Virtual scroll**: MessageList uses @tanstack/react-virtual
8. **O(1) tool call index**: Map<string, number> for tool call upsert

### Obsidian Plugin 规范
1. No innerHTML/outerHTML - use createEl/createDiv/createSpan
2. NO detach leaves in onunload (antipattern)
3. Styles in CSS only - no JS style manipulation
4. Use Platform interface - not process.platform
5. Minimize `any` - use proper types

### 命名约定
- Types: `kebab-case.ts` in `types/`
- ACP: `kebab-case.ts` in `acp/`
- Services: `kebab-case.ts` in `services/`
- Hooks: `use*.ts` in `hooks/`
- Components: `PascalCase.tsx` in `ui/`
- Utils: `kebab-case.ts` in `utils/`

### 代码模式
1. React hooks for state management
2. useCallback/useMemo for performance
3. useRef for cleanup function access
4. Error handling: try-catch async ops
5. **Upsert pattern**: `setMessages` functional updates
6. **Ref pattern for callbacks**: IChatViewContainer via refs
7. **Context value stability**: ChatContext value created once
8. **Stable empty arrays**: Module-level constants

## 七、常见任务

### 添加新 Feature Hook
1. Create `hooks/use[Feature].ts`
2. Call in `ui/ChatPanel.tsx`
3. Pass state/callbacks to child components as props
4. Wrap return in `useMemo` if used as hook dependency

### 添加 Agent 类型
1. Add settings type in `types/agent.ts`
2. Add config and defaults in `plugin.ts`
3. Add API key injection in `services/session-helpers.ts`
4. Update `ui/SettingsTab.ts`

### 修改消息类型
1. Update `types/chat.ts`
2. If new session update type: add to `SessionUpdate` union, handle in hooks
3. Update `acp/acp-handler.ts`
4. Update `ui/MessageBubble.tsx`

### 调试
1. Settings → Developer Settings → Debug Mode ON
2. Open DevTools (Cmd+Option+I / Ctrl+Shift+I)
3. Filter logs: `[AcpClient]`, `[AcpHandler]`, `[PermissionManager]`, `[VaultService]`

## 八、ACP 协议

**Communication**: JSON-RPC 2.0 over stdin/stdout

**Methods**: initialize, newSession, authenticate, prompt, cancel, setSessionConfigOption
**Notifications**: session/update (agent_message_chunk, agent_thought_chunk, user_message_chunk, tool_call, tool_call_update, plan, available_commands_update, current_mode_update, session_info_update, usage_update, config_option_update)
**Requests**: requestPermission
**Session Management** (unstable): session/list, session/load, session/resume, session/fork

**Agents**:
- Claude Code: `@agentclientprotocol/claude-agent-acp` (ANTHROPIC_API_KEY)
- Codex: `@zed-industries/codex-acp` (OPENAI_API_KEY)
- Gemini CLI: `@google/gemini-cli` (GEMINI_API_KEY)
- Custom: Any ACP-compatible agent

---

**Last Updated**: July 2026 | **Forked from**: RAIT-09/obsidian-agent-client v0.11.0 | **Architecture**: useAgent facade + sub-hooks