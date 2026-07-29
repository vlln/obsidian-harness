# Quick Start

This guide gets you working with an AI agent in just a few minutes.

## Step 1: Choose Your Agent

Obsidian Harness supports multiple AI agents. Choose one to start:

| Agent | Provider | Integration |
|-------|----------|-------------|
| **[Claude Code](/agent-setup/claude-code)** | Anthropic | via [ACP adapter](https://github.com/agentclientprotocol/claude-agent-acp) |
| **[Codex](/agent-setup/codex)** | OpenAI | via [Zed's adapter](https://github.com/zed-industries/codex-acp) |
| **[Gemini CLI](/agent-setup/gemini-cli)** | Google | with `--experimental-acp` option |
| **[Custom](/agent-setup/custom-agents)** | Various | [Any ACP-compatible agent](https://agentclientprotocol.com/overview/agents) (e.g., OpenCode, Qwen Code, Kiro) |

## Step 2: Install and Configure the Agent

Follow the setup guide for your chosen agent:

- [Claude Code Setup](/agent-setup/claude-code)
- [Codex Setup](/agent-setup/codex)
- [Gemini CLI Setup](/agent-setup/gemini-cli)
- [Custom Agents](/agent-setup/custom-agents)

Each guide covers installation, path configuration, and authentication.

## Step 3: Start a Session

1. Click the **robot icon** in the left ribbon (or run **Open session manager** from the command palette).
2. In the **Session Navigator** (left sidebar), click **New session**, name your project, and confirm.
3. The new `.session` workspace opens — type a message and press Enter!

::: tip
You can also open any existing `.session` note directly from the Navigator or your vault. Each open workspace has a **Turn Navigator** rail on the left edge for jumping between turns, and a **panel-left** toggle in the header to flip back to the Navigator.
:::

## What's Next?

- Learn about [Note Mentions](/usage/mentions) to reference your notes in conversations
- Explore [Slash Commands](/usage/slash-commands) for quick actions
- Set up additional agents in [Agent Setup](/agent-setup/)
