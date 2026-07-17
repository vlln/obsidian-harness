---
title: Plan-01 Session Restore Agent Identity
description: 修复 .session 文件 agentId 为空导致恢复时无法稳定选择同一 ACP 后端的问题。
type: plan
status: done
created: 2026-07-17T00:00:00Z
---

# Plan-01 Session Restore Agent Identity

## Context

`.session` 文件创建时允许 `agentId: ""`，首次连接后依赖运行时默认 agent。当前 sessionId 可从 local bootstrap ID 回写为 ACP sessionId，但 agentId 未同步写回，导致下一次打开 `.session` 时 session/load 可能用默认 agent 猜测后端。

这会让同一个 ACP session 在恢复时缺少确定的 agent identity，是 session 恢复“不稳定/不对”的高风险原因。

## Request

1. 抽出可测试的 sessionId/agentId 恢复 helper。
2. 当 `.session` 原始 agentId 为空且运行时 session 已解析出 agentId 时，写回 `.session` 文件。
3. 将 ACP sessionId 视为 opaque string，不按 ULID/UUID 字符串形态判断是否可恢复。
4. 补单元测试覆盖该约束。

## Constraints

- 不改变 `.session` 文件结构。
- 不删除 E2E 运行生成的未跟踪 vault 产物。
- 不退回 DESIGN；该问题按 SYSTEM_TEST 局部 bug 修复处理。

## Checkpoint

- `npm test` 通过。
- `npx tsc --noEmit --skipLibCheck` 通过。
- `npm run build` 通过。
