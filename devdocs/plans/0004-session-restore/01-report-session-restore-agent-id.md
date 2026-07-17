---
title: Report-01 Session Restore Agent Identity
description: 修复 .session 文件首次解析后未持久化 agentId，导致后续 session/load 恢复后端不确定的问题。
type: report
status: complete
created: 2026-07-17T00:00:00Z
---

# Report-01 Session Restore Agent Identity

## 实施内容

- 新增 `shouldRestoreInitialSession()`：只要 `.session` 同时有 sessionId 和 agentId，就先尝试 `session/load`，不按字符串形态猜测 ACP sessionId。
- 新增 `shouldPersistResolvedAgentId()`：当 `.session` 中 agentId 为空且运行时已解析出 agentId 时，判定需要写回。
- `ChatPanel` 在 session agentId 可用后调用 `onAgentIdChanged`，让 `HarnessSessionView` 写回 `.session`。
- `HarnessSessionView` 不再按 ULID/UUID 形态阻止 sessionId 写回；ACP sessionId 是 opaque string。
- `useAgentSession.closeSession()` 不再发送 `session/cancel`；关闭 tab/view 只断开 agent 进程，避免已完成对话在关闭时被后端解释为取消/中断。
- 删除 ACP sessionId 的 ULID 形态假设。pi-acp 返回 UUID-like sessionId（例如 `019f70f6-6efc-768d-adf0-9916735b58db`），按字符串形态判断会把真实 ACP session 误判为本地 bootstrap ID，导致重新打开时走 `session/new` 而不是 `session/load`。
- 新增 `scripts/probe-pi-acp-session.mjs` 作为 ACP 级诊断脚本，验证 `pi-acp session/new -> prompt -> 新进程 session/load -> prompt` 可以恢复 “hi” 历史。
- 新增 `test/session-helpers.test.ts` 覆盖恢复相关 helper。
- 更新 `.gitignore` 和 ESLint ignore，排除 E2E 运行生成的 Obsidian vault 状态和插件产物，避免工作树与 lint 被运行产物污染。

## 验证结果

| 验证项 | 结果 |
|--------|------|
| `npm test` | PASS: 3 files, 68 tests |
| `npx tsc --noEmit --skipLibCheck` | PASS |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS: 5/5 |
| `node scripts/probe-pi-acp-session.mjs test/vaults/simple` | PASS: `session/load` replayed `user_message_chunk: hi`，第二轮能回答“你刚才说了 hi” |
| 手动测试 vault | PASS: 用户按“新建 session → pi-acp → hi → 切 tab → 恢复 → 询问刚才说了什么”路径确认 bug 已解决 |

## 已知限制

- `npm run lint` 问题已在后续 0005 lint baseline 中收口，当前 lint 门禁为 PASS。
- 本修复解决 agent identity 持久化缺口和 ACP sessionId 形态误判。若恢复仍异常，下一步应检查 `.session` 文件是否已被旧版本写成无法恢复的本地 bootstrap ID。
- 手动测试必须先确认 Obsidian 已加载最新构建；此前一次复测失败是因为测试环境仍在运行旧 `main.js`。
