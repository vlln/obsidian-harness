---
title: Spec-0005: Append Agent Output to Notes
description: Define explicit user-controlled appending of the latest Agent response into an Obsidian Markdown note.
type: spec
status: active
version: 1
created: 2026-07-17T00:00:00Z
---

# Spec-0005: Append Agent Output to Notes

## Scope

Users can explicitly append the latest Agent response from an open session to the active Markdown note. This closes the note-centric loop: start from a note, discuss with an Agent, then place useful output back into a note under user control.

## Product Boundary

- Append is a plugin command initiated by the user.
- Append does not create a dedicated Agent write-back channel.
- Agents still read and write files through paths and their own tools.
- The plugin does not infer Project ownership or route output through a Project model.

## User Stories

| ID | Story | Priority |
|----|-------|----------|
| US-005-1 | Append the latest Agent response to the current Markdown note | P0 |
| US-005-2 | Run the append action from the chat view menu or command palette | P0 |
| US-005-3 | Receive a clear Notice when there is no response or no Markdown note | P0 |

## Behavior

The append operation finds the most recent assistant message with plain text content, formats it as a dated Markdown section, and appends it to the active Markdown note.

Format:

```md

## Agent response - 2026-07-17 19:00

...latest assistant text...
```

Rules:

- Only assistant text content is appended.
- Tool calls, images, and resource links are not appended in this iteration.
- If the active note is the `.session` file, the command reports that a Markdown note is required.
- The command does not mutate session history.

## UI

- Add a command: `Append last agent response to current note`.
- Add a chat menu item with the same action.
- Show `Notice` feedback for success, missing note, or missing response.

## Non-Goals

- Append summary generation.
- Append to a note picker target.
- Automatic append on turn completion.
- Project-aware output routing.
