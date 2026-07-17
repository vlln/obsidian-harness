---
title: Plan-01 Session Lifecycle Hardening
description: 抽取并测试 ChatPanel 初始 session restore/create/wait 决策，避免 session 恢复路径回归。
type: plan
status: done
created: 2026-07-17T00:00:00Z
---

# Plan-01 Session Lifecycle Hardening

## Context

Session 恢复 bug 暴露出初始生命周期决策分散的问题：`.session` 打开时 restore effect 和 create effect 分别判断 agentId/sessionId 状态，容易重新引入不一致条件。

## Request

1. 将初始生命周期决策抽成纯 helper。
2. 覆盖 restore existing、create new、wait for agent、restore already started 等关键分支。
3. 将 sessionId 写回判断抽成纯 helper。
4. 保持 ACP 行为不变，不重写 session storage 或 UI 架构。

## Constraints

- 不改变 `.session` 文件结构。
- 不改变 ACP session/load、session/new 调用语义。
- 不把本地测试环境路径写入仓库文档。

## Checkpoint

- `npm test` 通过。
- `npm run build` 通过。
- `npm run lint` 通过。
- `npm run test:e2e` 通过。
