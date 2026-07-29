<h1 align="center">Obsidian Harness</h1>

<p align="center">
  <img src="https://img.shields.io/github/downloads/vlln/obsidian-harness/total" alt="GitHub Downloads">
  <img src="https://img.shields.io/github/license/vlln/obsidian-harness" alt="License">
  <img src="https://img.shields.io/github/v/release/vlln/obsidian-harness" alt="GitHub release">
  <img src="https://img.shields.io/github/last-commit/vlln/obsidian-harness" alt="GitHub last commit">
  <a href="https://github.com/vlln/obsidian-harness/discussions"><img src="https://img.shields.io/github/discussions/vlln/obsidian-harness" alt="GitHub Discussions"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.ja.md">日本語</a>
</p>

> **Obsidian 即驾驶舱，Agent 即引擎。** 你的知识库就是控制平面，AI 编程 Agent 是执行层。Session 是 vault 里可打开、可链接、可搜索、可恢复的文件——而不只是一个聊天面板。

Obsidian Harness 把你的 vault 变成 AI 编程 Agent（Claude Code、Codex、Gemini CLI 以及任何兼容 ACP 的 Agent）的驾驶舱。与普通的「和 Agent 聊天」插件不同，Harness 把每个 **agent session 当作 vault 中的一等公民文件**——一个 `.session` 笔记，可以像其他笔记一样移动、链接、重新打开——并提供 Codex 风格的导航器，让你跨项目、跨 turn、跨后端穿梭你的工作。

基于 Zed 的 [Agent Client Protocol (ACP)](https://github.com/agentclientprotocol/agent-client-protocol) 构建。

https://github.com/user-attachments/assets/4d55316a-f913-4353-bf56-d967e0af862e

## 为什么用 Harness

每个 AI 编程 Agent 都把 session 关在自己的孤岛里——上下文跨 Agent、跨设备、跨重启都活不下来。Harness 通过 **把 agent session 折叠进你的知识库** 来解决：

- **Session 是 vault 文件。** 一个 session 就是一条 `.session` 笔记，可以在文件夹间移动、被其他笔记反向链接、通过搜索找到、随时重新打开。IDE 变成文件查看器，Agent 干活，你留在驾驶舱里。
- **离线可读。** transcript 渲染完整对话——用户 turn、助手回复、工具调用——无需运行中的 agent。即便后端已不在，历史依然有用。
- **跨 Agent 且可恢复。** Session 以 ACP 格式存储；导入的 session 携带指向原后端的 `acpBinding`，当 agent 在本地配好后，可在原地恢复真实对话。
- **一个驾驶舱，多个 Agent。** Claude Code、Codex、Gemini CLI 或任何兼容 ACP 的 agent——切换后端而不丢失你的 session 图。

## 功能

### 驾驶舱——像笔记一样浏览你的 session
- **Session Navigator**——Codex 风格的侧边栏，按 **Project** 和 **Recents** 组织 session，每行显示实时运行状态。Project 由每个 session 的工作目录投影而来，无需维护独立的项目实体。
- **Turn Navigator**——消息列表左侧的轨道，每个用户 turn 一个节点。悬停预览 turn 摘要，点击平滑跳转，滚动时高亮当前 turn。长对话里再也不会迷路。
- **Session Manager**——专门用于浏览、打开、管理 vault 中每个 session 的视图。
- **新建 session 弹窗**——输入项目名并（可选）选择一个 agent 工作目录即可开始；`.session` 入口留在 vault，agent 在所选 `cwd` 中工作。

### 导入与恢复历史
- **Session Importer**（配套技能）——把一个已有的 Claude Code / Codex / Pi Agent / Kimi Code session 转换成标准的、可读且可恢复的 Harness session，写入你的 vault。每次一个、显式选择、幂等。
- **ACP 绑定与续接**——导入的 session 绑定到原后端 session；agent 可用时恢复真实对话，不可用时优雅地继续阅读。

### 聊天与 Agent 集成
- **笔记提及**——用 `@笔记名` 把任意笔记内容拉进你的 prompt。
- **多 Agent**——在 Claude Code、Codex、Gemini CLI 和自定义 agent 间切换。
- **多 Session**——在独立视图里同时运行多个 agent。
- **浮动聊天**——一个常驻、可折叠的窗口，快速访问。
- **模式与模型切换**——在聊天里切换模型和 agent 模式。
- **斜杠命令**——使用你的 agent 提供的 `/` 命令。
- **终端集成**——agent 运行 shell 命令并内联返回结果。
- **聊天导出**——把对话保存为 Markdown 笔记，带 frontmatter 标签和 wikilink。
- **MCP 支持**——agent 使用其配置好的 MCP 服务器；插件内无需额外设置。

## 安装

### 通过 BRAT（推荐）

本插件（暂）未上架 Obsidian 社区插件目录。用 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 安装：

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 进入 **Settings → BRAT → Add Beta Plugin**
3. 粘贴：`https://github.com/vlln/obsidian-harness`
4. 在插件列表中启用 **Obsidian Harness**

### 手动安装

1. 从 [Releases](https://github.com/vlln/obsidian-harness/releases) 下载 `main.js`、`manifest.json`、`styles.css`
2. 放入 `VaultFolder/.obsidian/plugins/obsidian-harness/`
3. 在 **Settings → Community Plugins** 中启用插件

## 快速开始

打开终端（macOS/Linux 用 Terminal，Windows 用 PowerShell）运行以下命令。

1. **安装 agent 及其 ACP 适配器**（以 Claude Code 为例）：
   ```bash
   curl -fsSL https://claude.ai/install.sh | bash   # 安装 Claude Code
   npm install -g @agentclientprotocol/claude-agent-acp   # 安装 ACP 适配器
   ```

2. **登录**（使用 API key 则跳过）：
   ```bash
   claude
   ```
   按提示完成 Anthropic 账户认证。

3. **查找路径**：
   ```bash
   which node   # macOS/Linux
   which claude-agent-acp

   where.exe node   # Windows
   where.exe claude-agent-acp
   ```

4. **在 Settings → Obsidian Harness 中配置**：
   - **Node.js path**：例如 `/usr/local/bin/node`
   - **Agents → Claude Code → Path**：例如 `/usr/local/bin/claude-agent-acp`（不是 `claude`）
   - **API key**：填入你的 key，或留空（已通过 CLI 登录时）

5. **开始使用**：点击 ribbon 里的机器人图标。用 **Session Navigator** 按项目浏览 session，用 **Turn Navigator** 在 turn 间跳转，打开任意 `.session` 文件阅读或恢复对话。

### 配置指南

- [Claude Code](https://vlln.github.io/obsidian-harness/agent-setup/claude-code.html)
- [Codex](https://vlln.github.io/obsidian-harness/agent-setup/codex.html)
- [Gemini CLI](https://vlln.github.io/obsidian-harness/agent-setup/gemini-cli.html)
- [Pi](https://vlln.github.io/obsidian-harness/agent-setup/pi.html)
- [自定义 Agent](https://vlln.github.io/obsidian-harness/agent-setup/custom-agents.html)（OpenCode、Qwen Code、Kiro、Mistral Vibe 等）

**[完整文档](https://vlln.github.io/obsidian-harness/)**

## Session Importer

本仓库附带一个配套技能——**`harness-session-importer`**——把一个已有的 Claude Code / Codex / Pi Agent / Kimi Code session 转换成标准的、可读且可恢复的 Obsidian Harness session，写入你的 vault。每次一个、显式选择、幂等；冲突时绝不覆盖。

```bash
python3 skills/harness-session-importer/scripts/import_session.py \
  --harness claude-code \
  --session ~/.claude/projects/<dir>/<uuid>.jsonl \
  --vault <vault-绝对路径> \
  --entry-dir Sessions \
  --adapter <harness-适配器-绝对路径>
```

支持的来源、前置条件和 CLI 契约见 [Session Importer 文档](https://vlln.github.io/obsidian-harness/reference/session-importer.html)。

## 开发

```bash
npm install
npm run dev
```

生产构建：
```bash
npm run build
```

## License

Apache License 2.0 - 详见 [LICENSE](LICENSE)。
