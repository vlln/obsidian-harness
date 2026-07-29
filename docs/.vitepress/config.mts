import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Obsidian Harness",
  description:
    "Obsidian as cockpit, Agent as engine — manage AI coding agents (Claude Code, Codex, Gemini CLI) from your knowledge base",

  // GitHub Pages base path
  base: "/obsidian-harness/",

  lastUpdated: true,
  cleanUrls: true,

  head: [
    ["link", { rel: "icon", type: "image/x-icon", href: "/obsidian-harness/favicon.ico" }],
    ["link", { rel: "icon", type: "image/png", sizes: "32x32", href: "/obsidian-harness/favicon-32x32.png" }],
    ["link", { rel: "icon", type: "image/png", sizes: "16x16", href: "/obsidian-harness/favicon-16x16.png" }],
    ["link", { rel: "apple-touch-icon", sizes: "180x180", href: "/obsidian-harness/apple-touch-icon.png" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    [
      "link",
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
    ["meta", { name: "og:type", content: "website" }],
    ["meta", { name: "og:title", content: "Obsidian Harness" }],
    [
      "meta",
      {
        name: "og:description",
        content: "Obsidian as cockpit, Agent as engine — manage AI coding agents from your knowledge base",
      },
    ],
    [
      "meta",
      {
        name: "og:url",
        content: "https://vlln.github.io/obsidian-harness/",
      },
    ],
  ],

  themeConfig: {
    logo: "/apple-touch-icon.png",

    editLink: {
      pattern:
        "https://github.com/vlln/obsidian-harness/edit/master/docs/:path",
      text: "Edit this page on GitHub",
    },

    docFooter: {
      prev: "Previous",
      next: "Next",
    },

    nav: [
      { text: "Home", link: "/" },
      { text: "Getting Started", link: "/getting-started/" },
      { text: "Agent Setup", link: "/agent-setup/" },
      { text: "Usage", link: "/usage/" },
      { text: "GitHub", link: "https://github.com/vlln/obsidian-harness" },
    ],

    sidebar: [
      {
        text: "Introduction",
        items: [{ text: "What is Obsidian Harness?", link: "/" }],
      },
      {
        text: "Getting Started",
        items: [
          { text: "Installation", link: "/getting-started/" },
          { text: "Quick Start", link: "/getting-started/quick-start" },
        ],
      },
      {
        text: "Agent Setup",
        items: [
          { text: "Overview", link: "/agent-setup/" },
          { text: "Claude Code", link: "/agent-setup/claude-code" },
          { text: "Codex", link: "/agent-setup/codex" },
          { text: "Gemini CLI", link: "/agent-setup/gemini-cli" },
          { text: "Custom Agents", link: "/agent-setup/custom-agents" },
        ],
      },
      {
        text: "Usage",
        items: [
          { text: "Basic Usage", link: "/usage/" },
          { text: "Note Mentions", link: "/usage/mentions" },
          { text: "Sending Images and Files", link: "/usage/sending-images" },
          { text: "Slash Commands", link: "/usage/slash-commands" },
          { text: "Mode Selection", link: "/usage/mode-selection" },
          { text: "Model Selection", link: "/usage/model-selection" },
          { text: "Session History", link: "/usage/session-history" },
          { text: "Multi-Session Chat", link: "/usage/multi-session" },
          { text: "Session Navigator", link: "/usage/session-manager" },
          { text: "Floating Chat", link: "/usage/floating-chat" },
          { text: "Editing", link: "/usage/editing" },
          { text: "Chat Export", link: "/usage/chat-export" },
          { text: "Commands & Hotkeys", link: "/usage/commands" },
          { text: "Context Files", link: "/usage/context-files" },
          { text: "Prompt Injection", link: "/usage/prompt-injection" },
          { text: "MCP Tools", link: "/usage/mcp-tools" },
        ],
      },
      {
        text: "Help",
        items: [
          { text: "FAQ", link: "/help/faq" },
          { text: "Troubleshooting", link: "/help/troubleshooting" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "ACP Protocol Support", link: "/reference/acp-support" },
          { text: "Session Importer", link: "/reference/session-importer" },
        ],
      },
    ],

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/vlln/obsidian-harness",
      },
    ],

    footer: {
      message: "Released under the Apache 2.0 License.",
      copyright: "Copyright © 2025-present vlln",
    },

    search: {
      provider: "local",
    },
  },
});
