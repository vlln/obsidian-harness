# Pi Agent Setup

[Pi](https://zed.dev/acp/agent/pi) is an open AI coding agent with first-class ACP support. Harness ships a built-in **Pi** preset that runs the `pi-acp` adapter, so you can drive Pi from a `.session` workspace exactly like Claude Code or Codex.

Pi manages its own authentication (account login or API key configured on the Pi side), so the Harness preset needs **no API key field** — it relies on Pi's local login state.

## Install

### 1. Install the Pi CLI

```bash
npm install -g @vaayne/pi-coding-agent
```

This provides the `pi` command.

### 2. Install the ACP adapter

```bash
npm install -g pi-acp
```

This provides the `pi-acp` command that Harness spawns. (You can also run it on demand with `npx pi-acp`.)

### 3. Log in

```bash
pi
```

Follow Pi's prompts to authenticate. Pi stores its credentials in your system keychain; Harness never touches them.

::: tip
Pi keeps its sessions under `~/.pi/agent/sessions/<dir>/`. The Harness [Session Importer](/reference/session-importer) can convert an existing Pi session into a readable-and-resumable `.session` note.
:::

## Configure in Harness

Pi is a **built-in preset** — it already appears under **Settings → Obsidian Harness → Agents** as the **Pi** entry. In most cases no editing is needed:

| Field | Value |
|-------|-------|
| **Agent ID** | `pi-acp` |
| **Display name** | `Pi` |
| **Path** | `pi-acp` (click **Auto-detect** to resolve the absolute path) |
| **Arguments** | _(none)_ |
| **API key** | _(leave empty — Pi uses its own login)_ |
| **Environment variables** | _(optional)_ |

If `pi-acp` is not auto-detected, run `which pi-acp` (macOS/Linux) or `where.exe pi-acp` (Windows) and paste the absolute path.

## Verify Setup

1. Click the robot icon in the ribbon (or run **Open session manager**).
2. In the Session Navigator, click **New session**, then select **Pi** from the agent dropdown in the header.
3. Send a message to verify the connection.

Having issues? See [Troubleshooting](/help/troubleshooting).
