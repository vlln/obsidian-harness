# Basic Usage

## The Session Navigator — your entry point

Click the **robot icon** in the left ribbon (or run the **Open session manager** command) to open the **Session Navigator** in the left sidebar. It lists every session in your vault, organized by **Project** (projected from each session's working directory) and **Recents**, with live run status on each row.

<p align="center">
  <img src="/images/session-manager-view.webp" alt="Session Navigator" />
</p>

From the Navigator you can:

- **Open a session** — click any row to open its `.session` file. The file view renders the full conversation and a **Turn Navigator** rail on the left edge (one node per user turn).
- **Start a new session** — click **New session**, name the project, and (optionally) pick an agent working directory. The `.session` entry stays in your vault; the agent works in the chosen `cwd`.
- **Reveal / manage** — each project row's menu offers *New session here*, *Open in system file manager*, and *Copy path*.

::: tip
Sessions are first-class vault files. You can also open, backlink, search, and move a `.session` note exactly like any other note — the Navigator is just a cockpit over them.
:::

## The header navigator toggle

Any open `.session` workspace shows a **panel-left** toggle in its header, before the More menu. Click it (or focus it and press Enter/Space) to reveal the Session Navigator without leaving the session. It reuses the existing navigator leaf, so it never creates duplicates.

## Sending messages

1. Type your message in the input field at the bottom
2. Press `Enter` or click the send button
3. Wait for the agent's response

<p align="center">
  <img src="/images/sending-messages.webp" alt="Sending Messages" width="400" />
</p>

## Sending Images and Files

You can attach images and files to your messages by pasting or dragging and dropping.

1. **Paste**: Copy a file or image and paste (`Cmd/Ctrl + V`) in the input field
2. **Drag and Drop**: Drag files directly onto the input area

Attached files appear as thumbnails or file icons below the text area. Click the **×** to remove.

<p align="center">
  <img src="/images/sending-images.webp" alt="Sending Images and Files" width="400" />
</p>

::: tip
Embedding images requires agent support. Non-image files are always sent as file path references.
:::

See [Sending Images and Files](/usage/sending-images) for more details.

## Switching Agents

To switch agents for the current view:

1. Click the **⋮** (ellipsis) menu in the chat header
2. Under **"Switch agent"**, select the agent you want to use

This is a one-time change for that view only.

<p align="center">
  <img src="/images/switch-agent.webp" alt="Switch agent menu" width="400" />
</p>

::: tip
To change the default agent for new sessions, go to **Settings → Obsidian Harness → Default agent**.

<img src="/images/switch-default-agent.webp" alt="Default agent setting" />
:::

## Multiple Sessions

You can open multiple `.session` workspaces (or legacy chat views) to run independent conversations simultaneously. Each has its own agent process and session.

See [Multi-Session Chat](/usage/multi-session) for details on opening multiple views, broadcast commands, and focus navigation.

## Floating Chat

A draggable, resizable chat window that floats over your workspace. Enable it in **Settings → Obsidian Harness → Floating chat**.

See [Floating Chat](/usage/floating-chat) for details.

## Changing Models and Modes

Below the input field, you'll find dropdowns to:

- **Change Model**: Switch between different AI models (e.g., Sonnet, Haiku for Claude)
- **Change Mode**: Switch agent modes (e.g., Plan Mode)

::: tip
Available models and modes depend on the active agent.
:::

## Stopping Generation

If the agent is generating a response and you want to stop it, click the **Stop** button that appears during generation.
