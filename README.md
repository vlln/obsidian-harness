<h1 align="center">Obsidian Harness</h1>

<p align="center">
  <img src="https://img.shields.io/github/downloads/vlln/obsidian-harness-frontend/total" alt="GitHub Downloads">
  <img src="https://img.shields.io/github/license/vlln/obsidian-harness-frontend" alt="License">
  <img src="https://img.shields.io/github/v/release/vlln/obsidian-harness-frontend" alt="GitHub release">
  <img src="https://img.shields.io/github/last-commit/vlln/obsidian-harness-frontend" alt="GitHub last commit">
  <a href="https://github.com/vlln/obsidian-harness-frontend/discussions"><img src="https://img.shields.io/github/discussions/vlln/obsidian-harness-frontend" alt="GitHub Discussions"></a>
</p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a>
</p>

> **Obsidian as cockpit, Agent as engine.** Your knowledge base is the control plane; AI coding agents are the execution layer. Sessions are vault files you can open, link, search, and resume — not just a chat panel.

Obsidian Harness turns your vault into a cockpit for AI coding agents (Claude Code, Codex, Gemini CLI, Pi, and any ACP-compatible agent). Unlike a plain "chat with agents" plugin, Harness treats every **agent session as a first-class file** in your vault — a `.session` note you move, link, and reopen like any other note — and gives you Codex-style navigators to roam your work across projects, turns, and agent backends.

Built on [Agent Client Protocol (ACP)](https://github.com/agentclientprotocol/agent-client-protocol) by Zed.

https://github.com/user-attachments/assets/0fcb6751-84cb-4eb9-b373-adb28e8115e0

## Why Harness

Every AI coding agent keeps its own session in its own silo — context doesn't survive across agents, across devices, or across reboots. Harness fixes that by **folding agent sessions into your knowledge base**:

- **Sessions are vault files.** A session lives as a `.session` note you can move between folders, backlink from other notes, find via search, and reopen any time. The IDE becomes a file viewer; the agent does the work; you stay in the cockpit.
- **Readable offline.** A transcript renders full conversations — user turns, assistant replies, tool calls — without a live agent running. Your history stays useful even after the backend is gone.
- **Cross-agent & resumable.** Sessions store in ACP format; an imported session carries an `acpBinding` to its original backend, so you can resume the real conversation in place when the agent is configured locally.
- **One cockpit, many agents.** Claude Code, Codex, Gemini CLI, Pi, or any ACP-compatible agent — switch backends without losing your session graph.

## Features

### The cockpit — navigate your sessions like notes
- **Session Navigator** — a Codex-style sidebar that organizes sessions by **Project** and **Recents**, with live run status on every row. Projects are projected from each session's working directory, so there's no separate project entity to manage.
- **Turn Navigator** — a left-rail track on the message list, one node per user turn. Hover to preview a turn summary, click to smooth-jump, and the active turn highlights as you scroll. Never lose your place in a long conversation.
- **Session Manager** — a dedicated view to browse, open, and manage every session in the vault.
- **New-session modal** — start a session by naming a project and (optionally) picking an agent working directory; the `.session` entry stays in the vault while the agent works in the chosen `cwd`.

### Import & resume history
- **Session Importer** (companion skill) — convert an existing Claude Code / Codex / Pi Agent / Kimi Code session into a standard, readable-and-resumable Harness session inside your vault. One session at a time, explicitly selected, idempotent.
- **ACP binding & continuation** — imported sessions bind to their original backend session; resume the real conversation when the agent is available, or keep reading gracefully when it's not.

### Chat & agent integration
- **Note Mentions** — pull any note's content into your prompt with `@notename`.
- **Multi-Agent** — switch between Claude Code, Codex, Gemini CLI, Pi, and custom agents.
- **Multi-Session** — run several agents in separate views at once.
- **Floating Chat** — a persistent, collapsible window for quick access.
- **Mode & Model Switching** — change models and agent modes from the chat.
- **Slash Commands** — use `/` commands provided by your agent.
- **Terminal Integration** — agents run shell commands and return results inline.
- **Chat Export** — save conversations as Markdown notes, with frontmatter tags and wikilinks.
- **MCP Support** — agents use their configured MCP servers; no extra setup in the plugin.

## Installation

### Via BRAT (Recommended)

This plugin is not (yet) in the Obsidian Community Plugins directory. Install it with [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Go to **Settings → BRAT → Add Beta Plugin**
3. Paste: `https://github.com/vlln/obsidian-harness-frontend`
4. Enable **Obsidian Harness** from the plugin list

### Manual Installation

1. Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/vlln/obsidian-harness-frontend/releases)
2. Place them in `VaultFolder/.obsidian/plugins/obsidian-harness/`
3. Enable the plugin in **Settings → Community Plugins**

## Quick Start

Open a terminal (Terminal on macOS/Linux, PowerShell on Windows) and run the following commands.

1. **Install an agent and its ACP adapter** (e.g., Claude Code):
   ```bash
   curl -fsSL https://claude.ai/install.sh | bash   # Install Claude Code
   npm install -g @agentclientprotocol/claude-agent-acp   # Install ACP adapter
   ```

2. **Login** (skip if using an API key):
   ```bash
   claude
   ```
   Follow the prompts to authenticate with your Anthropic account.

3. **Find the paths**:
   ```bash
   which node   # macOS/Linux
   which claude-agent-acp

   where.exe node   # Windows
   where.exe claude-agent-acp
   ```

4. **Configure** in **Settings → Obsidian Harness**:
   - **Node.js path**: e.g., `/usr/local/bin/node`
   - **Agents → Claude Code → Path**: e.g., `/usr/local/bin/claude-agent-acp` (not `claude`)
   - **API key**: Add your key, or leave empty if logged in via CLI

5. **Start working**: Click the robot icon in the ribbon. Use the **Session Navigator** to browse sessions by project, the **Turn Navigator** to jump between turns, and open any `.session` file to read or resume a conversation.

### Setup Guides

- [Claude Code](https://vlln.github.io/obsidian-harness/agent-setup/claude-code.html)
- [Codex](https://vlln.github.io/obsidian-harness/agent-setup/codex.html)
- [Gemini CLI](https://vlln.github.io/obsidian-harness/agent-setup/gemini-cli.html)
- [Custom Agents](https://vlln.github.io/obsidian-harness/agent-setup/custom-agents.html) (OpenCode, Qwen Code, Kiro, Mistral Vibe, etc.)

**[Full Documentation](https://vlln.github.io/obsidian-harness/)**

## Session Importer

This repo ships a companion skill — **`harness-session-importer`** — that converts an existing Claude Code / Codex / Pi Agent / Kimi Code session into a standard, readable-and-resumable Obsidian Harness session inside your vault. One session at a time, explicitly selected; idempotent; never overwrites on conflict.

```bash
python3 skills/harness-session-importer/scripts/import_session.py \
  --harness claude-code \
  --session ~/.claude/projects/<dir>/<uuid>.jsonl \
  --vault <absolute-vault-path> \
  --entry-dir Sessions \
  --adapter <absolute-harness-adapter-path>
```

See the [Session Importer docs](https://vlln.github.io/obsidian-harness/reference/session-importer.html) for supported sources, prerequisites, and the CLI contract.

## Development

```bash
npm install
npm run dev
```

For production builds:
```bash
npm run build
```

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
