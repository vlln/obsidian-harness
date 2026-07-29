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
      link: https://github.com/vlln/obsidian-harness
---

<p class="oh-badges">
  <img src="https://img.shields.io/github/v/release/vlln/obsidian-harness?label=release&color=a88bfa" alt="GitHub release" />
  <img src="https://img.shields.io/github/downloads/vlln/obsidian-harness/total?label=installs&color=a88bfa" alt="Downloads" />
  <img src="https://img.shields.io/github/license/vlln/obsidian-harness?label=license&color=a88bfa" alt="License" />
  <img src="https://img.shields.io/github/stars/vlln/obsidian-harness?label=stars&color=a88bfa" alt="Stars" />
</p>

<div class="oh-demo">
  <video controls autoplay loop muted playsinline poster="/demo-poster.png">
    <source src="/demo.mp4" type="video/mp4">
  </video>
</div>

## What is Obsidian Harness?

Obsidian Harness turns your vault into a cockpit for AI coding agents (Claude Code, Codex, Gemini CLI, and any ACP-compatible agent). Unlike a plain "chat with agents" plugin, Harness treats every **agent session as a first-class file** in your vault — a `.session` note you move, link, and reopen like any other note — and gives you Codex-style navigators to roam your work across projects, turns, and agent backends.

Built on [Agent Client Protocol (ACP)](https://github.com/agentclientprotocol/agent-client-protocol) by Zed.

### Supported Agents

| | Agent | Provider | Integration |
|---|-------|----------|-------------|
| <span class="oh-agent-badge" style="--c:#d97757">C</span> | **[Claude Code](https://github.com/anthropics/claude-code)** | Anthropic | via [ACP adapter](https://github.com/agentclientprotocol/claude-agent-acp) |
| <span class="oh-agent-badge" style="--c:#10a37f">Co</span> | **[Codex](https://github.com/openai/codex)** | OpenAI | via [Zed's adapter](https://github.com/zed-industries/codex-acp) |
| <span class="oh-agent-badge" style="--c:#4285f4">G</span> | **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** | Google | with `--experimental-acp` option |
| <span class="oh-agent-badge" style="--c:#f59e0b">Pi</span> | **Pi Agent** | Pi | built-in preset, runs the `pi-acp` command |
| <span class="oh-agent-badge" style="--c:#a88bfa">◇</span> | **Custom** | Various | [Any ACP-compatible agent](https://agentclientprotocol.com/overview/agents) (e.g., OpenCode, Qwen Code, Kiro) |

### Key capabilities

<div class="oh-features">
  <div class="oh-feature">
    <h3>Sessions are vault files</h3>
    <p>Every agent session lives as a <code>.session</code> note — move it, backlink it, find it via search, and reopen it any time. The IDE becomes a file viewer; the agent does the work.</p>
  </div>
  <div class="oh-feature">
    <h3>Session Navigator</h3>
    <p>A Codex-style sidebar that organizes sessions by Project and Recents with live run status on every row. Projects are projected from each session's working directory.</p>
  </div>
  <div class="oh-feature">
    <h3>Turn Navigator</h3>
    <p>A left-rail track on the message list, one node per user turn. Hover to preview, click to smooth-jump, and the active turn highlights as you scroll.</p>
  </div>
  <div class="oh-feature">
    <h3>Import &amp; resume history</h3>
    <p>Convert an existing Claude Code / Codex / Pi Agent / Kimi Code session into a readable-and-resumable Harness session. Resume the real conversation in place when the agent is available.</p>
  </div>
  <div class="oh-feature">
    <h3>One cockpit, many agents</h3>
    <p>Claude Code, Codex, Gemini CLI, or any ACP-compatible agent — switch backends without losing your session graph.</p>
  </div>
  <div class="oh-feature">
    <h3>Note mentions &amp; export</h3>
    <p>Pull any note into your prompt with <code>@notename</code>, and export conversations as Markdown notes with frontmatter tags and wikilinks.</p>
  </div>
</div>

Ready to get started? Check out the [Installation Guide](/getting-started/).
