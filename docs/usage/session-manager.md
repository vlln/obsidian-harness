# Session Navigator

A Codex-style sidebar that lists every session in your vault, organized by **Project** and **Recents**, with live run status on each row. It is the primary cockpit for browsing, opening, and starting sessions.

<p align="center">
  <img src="/images/session-manager-view.webp" alt="Session Navigator in the left sidebar" width="400" />
</p>

## Overview

The Session Navigator discovers sessions through the vault's shared catalog and shows:

- **Project** groups — projected from each session's working directory (`cwd`), so there is no separate project entity to manage
- **Recents** — your most recently active sessions
- **Status icon** — a live indicator of what each session is doing right now
- **Active highlight** — the currently focused session is marked

::: tip
Because sessions are vault files, the Navigator is just a cockpit over them — you can also open, search, backlink, and move a `.session` note like any other note.
:::

## Opening the Navigator

- **Ribbon**: Click the **robot icon** in the left ribbon
- **Header toggle**: In any open `.session` workspace, click the **panel-left** button before the More menu
- **Command palette**: Run **Open session manager** (`Cmd/Ctrl + P`)

The view opens in the left sidebar by default. You can drag it to a different location like any other Obsidian view.

::: tip
Assign a keyboard shortcut to **Open session manager** in **Settings → Hotkeys** for quick access.
:::

## Status Icons

Each session entry shows an icon reflecting its current state:

| Icon | Status | Meaning |
|------|--------|---------|
| <img src="/images/status-ready.webp" alt="Ready" width="32" /> | **Ready** | The session is connected and idle, waiting for your next message |
| <img src="/images/status-busy.webp" alt="Busy" width="32" /> | **Busy** | The agent is processing or generating a response |
| <img src="/images/status-permission.webp" alt="Permission" width="32" /> | **Permission** | The agent is waiting for you to approve or reject an action |
| <img src="/images/status-error.webp" alt="Error" width="32" /> | **Error** | The session encountered an error |

## Starting a session

Click **New session** to open the creation modal: name the project and (optionally) pick an agent working directory. The `.session` entry stays in your vault while the agent works in the chosen `cwd`.

## Project actions

Each project row's menu (click the **⋯** button, or right-click the row) offers:

- **New session here** — start a session whose `cwd` is this project
- **Open in system file manager** — reveal the project folder in your OS file manager
- **Copy path** — copy the project's `cwd` to the clipboard

## Search

Use the search field to filter sessions across all fields; the Navigator restores Project expansion state after a search.

## See Also

- [Multi-Session Chat](/usage/multi-session) for opening multiple sessions and broadcasting prompts
- [Session History](/usage/session-history) for resuming or forking past sessions
- [Floating Chat](/usage/floating-chat) for floating chat windows
