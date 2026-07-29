---
layout: home

hero:
  name: "Obsidian Harness"
  text: "Obsidian as cockpit, Agent as engine"
  tagline: Your knowledge base is the control plane; AI coding agents are the execution layer. Sessions are vault files you can open, link, search, and resume — not just a chat panel.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: View on GitHub
      link: https://github.com/vlln/obsidian-harness-frontend

features:
  - icon: 🗂️
    title: Sessions are vault files
    details: Every agent session lives as a `.session` note — move it, backlink it, find it via search, and reopen it any time. The IDE becomes a file viewer; the agent does the work.
  - icon: 🧭
    title: Session Navigator
    details: A Codex-style sidebar that organizes sessions by Project and Recents with live run status on every row. Projects are projected from each session's working directory.
  - icon: 🔁
    title: Turn Navigator
    details: A left-rail track on the message list, one node per user turn. Hover to preview, click to smooth-jump, and the active turn highlights as you scroll.
  - icon: 📥
    title: Import & resume history
    details: Convert an existing Claude Code / Codex / Pi Agent / Kimi Code session into a readable-and-resumable Harness session. Resume the real conversation in place when the agent is available.
  - icon: 🤖
    title: One cockpit, many agents
    details: Claude Code, Codex, Gemini CLI, or any ACP-compatible agent — switch backends without losing your session graph.
  - icon: 📝
    title: Note mentions & export
    details: Pull any note into your prompt with `@notename`, and export conversations as Markdown notes with frontmatter tags and wikilinks.
---

<div style="max-width: 800px; margin: 2rem auto;">
  <video controls autoplay loop muted playsinline style="width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
    <source src="/demo.mp4" type="video/mp4">
  </video>
</div>

## What is Obsidian Harness?

Obsidian Harness turns your vault into a cockpit for AI coding agents (Claude Code, Codex, Gemini CLI, and any ACP-compatible agent). Unlike a plain "chat with agents" plugin, Harness treats every **agent session as a first-class file** in your vault — a `.session` note you move, link, and reopen like any other note — and gives you Codex-style navigators to roam your work across projects, turns, and agent backends.

Built on [Agent Client Protocol (ACP)](https://github.com/agentclientprotocol/agent-client-protocol) by Zed.

### Supported Agents

| Agent | Provider | Integration |
|-------|----------|-------------|
| **[Claude Code](https://github.com/anthropics/claude-code)** | Anthropic | via [ACP adapter](https://github.com/agentclientprotocol/claude-agent-acp) |
| **[Codex](https://github.com/openai/codex)** | OpenAI | via [Zed's adapter](https://github.com/zed-industries/codex-acp) |
| **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** | Google | with `--experimental-acp` option |
| **Custom** | Various | [Any ACP-compatible agent](https://agentclientprotocol.com/overview/agents) (e.g., OpenCode, Qwen Code, Kiro) |

Ready to get started? Check out the [Installation Guide](/getting-started/).
