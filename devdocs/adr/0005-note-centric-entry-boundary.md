---
title: ADR-0005: Note-Centric Entry Boundary
description: Notes and selections can start Agent sessions, but project organization remains user-owned Markdown structure.
type: adr
status: accepted
created: 2026-07-17T00:00:00Z
---

# ADR-0005: Note-Centric Entry Boundary

## Context

Obsidian Harness should make Obsidian the place where Agent work starts. Users may organize work through project notes, dashboards, folders, wikilinks, or other vault conventions. The plugin should support those conventions without turning them into a fixed product model.

## Decision

The plugin will support Markdown note and selection based Agent entry by creating or opening `.session` files linked to the source note.

The plugin will not add a first-class Project model. A project is a user's note structure. Session entry files remain the durable plugin-managed entry object.

## Constraints

| ID | Rule |
|----|------|
| ADR-0005-R-1 | Store source note metadata in `.session` files as vault-relative paths. |
| ADR-0005-R-2 | Do not create plugin settings or storage tables for Projects. |
| ADR-0005-R-3 | Do not add a custom agent protocol or intermediate message representation; ACP is the protocol boundary. |
| ADR-0005-R-4 | Do not add a dedicated write-back channel. Agents may use file paths and their own tools; users may explicitly export or append content through plugin commands. |
| ADR-0005-R-5 | UI may display entry context, but the source of truth remains the `.session` file and normal vault notes. |

## Consequences

This keeps the product aligned with vault-native work while preserving implementation simplicity. It also leaves room for future dashboards and workflows without coupling this iteration to a project schema.

## Verification

- E2E creates a session from a Markdown note and inspects the `.session` fields.
- E2E creates a session from selected text and inspects line range and text snapshot.
- Code review confirms no Project storage model or non-ACP protocol layer was introduced.
