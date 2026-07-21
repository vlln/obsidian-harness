---
title: ADR-0009: 导入 Session 绑定原生后端并可续聊
description: 导入产物写入指向原生后端会话的 acpBinding，使其可续聊；后端不可达时由 continuation state 自然降级。
type: adr
status: accepted
created: 2026-07-21T06:30:00Z
---

# ADR-0009: 导入 Session 绑定原生后端并可续聊

## 背景

[ADR-0008](0008-direct-session-import.md) 决定导入产物是只读历史，`.session` 不含
`acpBinding`。E1（可见性）据此验证通过：不连后端也能在 Obsidian 中渲染导入历史。

进入 E2（可续聊）时发现该只读约定与目标冲突。E2 要求"点开导入的 session → resume →
验证上下文真实恢复"，但 `deriveContinuationState` 的第一道判定是：

```
if (!entry.acpBinding) → read_only
```

无 binding 的产物永远是只读，无法进入续聊路径。

关键事实：导入器在解析各来源时**已经**读到了原生后端 session id（Claude/Pi/Codex 的
`sessionId`/`id`、Kimi 的 `session_id`），只是没有写进 `.session`。而插件续聊走
`acpBinding.sessionId → session/load`，用的正是这个原生 id，不是导入器算出的
`historyId`（UUIDv5）。因此只要把原生 id 作为 binding 写入，续聊链路即可打通。

## 决策

导入产物写入指向原生后端会话的 `acpBinding`，取代 ADR-0008 的"无 binding、只读"约定：

- `.session` 的 `agentId` 与 `acpBinding.agentId` 填对应 ACP agent id：
  `claude → claude-code-acp`、`codex → codex-acp`、`pi → pi-acp`、`kimi → kimi-acp`。
- `acpBinding.sessionId` 填**原生后端 session id**（来自来源解析的 identity），
  不是导入器生成的 `historyId`。
- manifest 的 `metadata.agentId` 同步填 agent id。
- 其余 ADR-0008 决策不变：直接生成标准 v2 存储、私有 parser 只留在 companion skill、
  不产生 report/receipt/bundle、确定性 ID 与幂等、不覆盖冲突目标。

## 后端不可达时的行为

vault 产物与原生后端会话是分离的：transcript 随 vault 走，原生会话留在本机
`~/.pi`、`~/.claude` 等目录，不随 vault 同步。换设备或删除后端会话后，binding 仍在但
指向的原生会话在当前机器不存在。此时行为是自然、优雅降级，不崩溃、历史不丢：

- **历史渲染不受影响**：打开时走 `readTranscript(historyId)`，只读本地 vault 文件，
  与后端在不在无关（代码中本地 transcript 加载与 ACP 启动刻意解耦）。
- **后端未配置 / cwd 不存在**：打开时 `deriveContinuationState` 判定为
  `backend_unavailable`，展示原因，不允许续聊。
- **后端在但原生会话已删**：打开时 binding 齐全、cwd 在，判定为 `available`；用户点
  "继续"时 `session/load` 才返回结构化错误（实测 pi-acp 返回
  `Unknown sessionId: <id>`），`handleContinueSession` catch 后切换到
  `backend_unavailable` 并展示后端原文，历史仍留在屏幕上。

已知瑕疵（不在本 ADR 修复）：换设备场景下 binding 齐全会被判为 `available`，需用户点
一次"继续"撞错才知道续不了。用 `session/list` 在打开时预检、提前降级是增强项，另开
plan，当前实现不动。

## 验证

E2 手测（pi-acp）通过：将 `~/.pi/agent/sessions` 下真实 pi session 用改后的导入器写入
`~/Documents/autowiki-vault/Sessions/`，产物带
`acpBinding{agentId: pi-acp, sessionId: 019f5f11-…}`。在 Obsidian 中打开该 session →
继续 → 发消息，pi-acp 成功 `session/load` 并恢复上下文，对话可继续。

CLI 层旁证：直接对 pi-acp 发 `session/load` 原生 id，成功回放原始 prompt；对不存在的
id 返回 `{"code":-32602,"data":"Unknown sessionId: …"}` 结构化错误，非崩溃。

集成测试：`test/session-import-plugin-reader.test.ts` 对四种来源断言导入产物的
`acpBinding` 值正确，且 `deriveContinuationState` 判定为 `available`（非 `read_only`）。

## 后果

导入产物从"只读历史"升级为"可续聊会话"，E2 得以成立。代价是导入器与插件的
continuation 契约（agent id 命名、原生 id 语义）耦合更紧；这是 companion skill 的预期
职责，随插件在同仓同 release 演进。ADR-0008 的只读定位不再成立，其相关 Spec/AC 条款
同步更新。
