---
title: Spec-0004: Note-Centric Agent Entry
description: Define note and selection based agent session entry without adding a plugin-level Project model.
type: spec
status: active
version: 1
created: 2026-07-17T00:00:00Z
---

# Spec-0004: Note-Centric Agent Entry

## Scope

This spec extends Spec-0001 session entry files so a normal Markdown note can start or own an Agent session. The plugin treats the note as the user's entry point and stores the resulting Agent session in a `.session` entry file.

## Product Boundary

- The plugin does not define a Project model.
- User notes, folders, links, and dashboards decide how work is organized.
- The plugin only provides entry capabilities from note, selection, and `.session` file.
- Agent file read/write goes through file paths and the agent's own tools.
- ACP remains the only backend-neutral protocol layer.
- Workflow orchestration and control-plane features are out of scope for this iteration.

## User Stories

| ID | Story | Priority |
|----|-------|----------|
| US-004-1 | Start an Agent session from the current Markdown note | P0 |
| US-004-2 | Start an Agent session from selected text in a Markdown note | P0 |
| US-004-3 | Reopen the generated `.session` entry and recover the same agent, cwd, and source note context | P0 |
| US-004-4 | Continue mentioning vault notes during the conversation | P1 |
| US-004-5 | Manually append Agent output to a note | P1 |

## Session File Extension

`.session` files keep the existing Spec-0001 fields and may include `sourceNote`.

```json
{
	"version": 1,
	"sessionId": "uuid-or-acp-session-id",
	"agentId": "pi-acp",
	"cwd": "/absolute/vault/or/workdir",
	"title": "Agent: Research note",
	"createdAt": "2026-07-17T00:00:00Z",
	"updatedAt": "2026-07-17T00:00:00Z",
	"forkedFrom": null,
	"sourceNote": {
		"path": "Projects/demo.md",
		"name": "demo",
		"selection": {
			"fromLine": 3,
			"toLine": 8,
			"text": "Selected context..."
		}
	}
}
```

Rules:

- `sourceNote.path` is vault-relative.
- `sourceNote.selection` is optional and only exists when non-empty text is selected.
- `sourceNote.selection.text` is a convenience snapshot for prompt prefill, not the authoritative note store.
- Reopening the session should preserve `sourceNote` and present it to the user as entry context.

## Commands

| Command | Behavior |
|---------|----------|
| `Start agent session from this note` | Create a `.session` entry next to the active Markdown note, store source note metadata, open it in the Harness session view, and prefill the prompt with the note path or selected range. |
| `Create new .session file` | Keep the existing root-level generic session behavior. |

## Out of Scope

- Cross-device summary generation.
- Project entity modeling in plugin settings or storage.
- Workflow DAGs, scheduled agents, and control-plane UI.
- A custom backend protocol or custom intermediate representation beyond ACP.
- A dedicated note write-back channel separate from agent file tools and explicit user commands.
