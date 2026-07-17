---
title: AC-0004: Append Agent Output to Notes
description: Acceptance criteria for explicitly appending the latest Agent response to the active Markdown note.
type: ac
status: active
created: 2026-07-17T00:00:00Z
---

# AC-0004: Append Agent Output to Notes

## Normal Scenarios

| ID | Preconditions | Steps | Expected Result | Verification |
|----|---------------|-------|-----------------|--------------|
| AC-0004-N-1 | Active chat has at least one assistant text response and active file is Markdown | Run `Append last agent response to current note` | Latest assistant text is appended to the Markdown note under an `Agent response` heading | Unit + E2E |
| AC-0004-N-2 | Active chat has multiple assistant responses | Run append command | Only the latest assistant text response is appended | Unit |

## Boundary Scenarios

| ID | Preconditions | Steps | Expected Result | Verification |
|----|---------------|-------|-----------------|--------------|
| AC-0004-B-1 | Latest assistant message contains text and non-text content | Run append command | Only text content is appended | Unit |
| AC-0004-B-2 | Active Markdown note already has content | Run append command | New section is appended after existing content without overwriting | Unit + E2E |

## Exception Scenarios

| ID | Preconditions | Steps | Expected Result | Verification |
|----|---------------|-------|-----------------|--------------|
| AC-0004-E-1 | No active Markdown note | Run append command | Notice reports that a Markdown note is required; no file is changed | E2E |
| AC-0004-E-2 | Chat has no assistant text response | Run append command | Notice reports that there is no Agent response to append | Unit |

## Failure Scenarios

| ID | Preconditions | Steps | Expected Result | Verification |
|----|---------------|-------|-----------------|--------------|
| AC-0004-F-1 | Vault append fails | Run append command | Notice reports failure and session remains usable | Agent judgement |
