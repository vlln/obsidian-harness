---
title: Report-0057-01: Agent Config Unification
description: 统一 agents[] 配置模型与单一 Agents Settings 分区实现完成，AC-0028/AC-0030 全部场景验收 PASS，gate:mr 全绿。
type: report
status: complete
created: 2026-07-29T05:12:23Z
---

# Report-0057-01: Agent Config Unification

## 结论

Spec-0008 / ADR-0012 全部落地。统一 `agents: AgentSettings[]` 模型取代四来源旧模型，
Settings 页重组为单一 Agents 分区。AC-0028、AC-0030 全部场景 **PASS**（单元/集成层）；
AC-0029 的 UI 行为属 SYSTEM_TEST 层（WDIO E2E），按测试执行边界另容器交付，本分支
交付其可单测部分（AC-0029-B-1 id 自动生成）。`npm run gate:mr` 全绿：
238 passed / 5 skipped，coverage 86.64%（阈值 80%）。

关联 commit：`9cef828`（`feat(settings): 实现 AC-0028/AC-0030 统一 agents[] 配置模型与密钥注入泛化`）。

## AC 验收表

| AC 场景 | 结果 | 测试用例（文件 → 用例名） |
|---------|------|---------------------------|
| AC-0028-N-1 | PASS | `test/agent-settings-normalizer.test.ts` → "missing agents key falls back to the four built-in defaults from Spec-0008 §4.3"（pi-acp 为第四条默认条目；探测代码已删除，由 `test/agent-config-boundary.test.ts` 静态钉住） |
| AC-0028-N-2 | PASS | 同上 → "a user-added entry loads with its original values" |
| AC-0028-B-1 | PASS | 同上 → "entry fields with wrong types fall back per-field, entry itself is kept" + "non-object entries are kept with per-field defaults" |
| AC-0028-B-2 | PASS | 同上 → "duplicate ids keep the first entry and drop later ones" |
| AC-0028-E-1 | PASS | 同上 → "legacy schema fields are ignored — not read, not migrated, not written back" |
| AC-0028-F-1 | PASS | 同上 → "a dangling defaultAgentId falls back to the first entry" + "an empty agents array yields an empty defaultAgentId and stays empty" |
| AC-0029-B-1 | PASS | 同上 → "generates custom-agent-N ids that are not already occupied" + "normalization assigns generated ids without collisions" |
| AC-0030-N-1 | PASS | `test/session-helpers.test.ts` → "attaches the injection intent from the entry's own fields — for any entry, not by agentId branch (AR-012-3)"；`test/agent-key-injection.test.ts` → "resolves the secret just before spawn and injects it under the entry's own env var name" |
| AC-0030-B-1 | PASS | `test/session-helpers.test.ts` → "%s carries no injection intent (BR-072)"（参数化：只配两者之一）；`test/agent-key-injection.test.ts` → "without an injection intent no secret storage read happens" |
| AC-0030-B-2 | PASS | `test/session-helpers.test.ts` → "keeps manual env in the config so the spawn-time injection can override the same-named entry (BR-073)"；`test/agent-key-injection.test.ts` → "the injected value overrides a same-named manual env entry (BR-073)" |
| AC-0030-E-1 | PASS | `test/agent-key-injection.test.ts` → "a deleted secret follows the existing missing-key semantics; other entries stay unaffected" |
| AC-0030-F-1 | PASS | `test/agent-key-injection.test.ts` → "a secretStorage read failure aborts before spawn and never leaks the plaintext" |
| AC-0029 其余（N-1~N-4、B-2、E-1、F-1） | 另容器交付 | WDIO E2E 属 SYSTEM_TEST 层（测试执行边界）；设置页 helper 已于 0055 就绪 |

## diff 摘要（12 文件，+966/-1081）

- `src/types/agent.ts`：五个旧类型 → `AgentEnvVar` + 统一 `AgentSettings`（7 字段）。
- `src/services/settings-normalizer.ts`：新增 `DEFAULT_AGENT_SETTINGS`（四条内置，Spec §4.3）、
  `normalizeAgentEntry`（逐字段回退）、`normalizeAgents`（去重/空 id 重生）、
  `resolveDefaultAgentId`（BR-070）；`toAgentConfig` 改吃统一类型。
- `src/plugin.ts`（-396 行净减）：settings 改 `agents[]`；loadSettings 不再读取/迁移旧
  schema（BR-074）；删除 `getDiscoveredAgents`/`isPiAcpAvailable` 探测特例（BR-075）；
  `getAvailableAgents` 直接映射 `agents[]`。
- `src/services/session-helpers.ts`：`findAgentSettings` 退化为数组查找；
  `buildAgentConfigWithApiKey` 按条目字段成对判断（BR-072），无 agentId 分支（AR-012-3）。
- `src/ui/SettingsTab.ts`（-487 行净减）：单一 `Agents` 分区 + 统一编辑器（七字段固定顺序），
  三处强制文案就位（Keychain 不落盘 / env var name 为空不注入 / env 勿填密钥）；
  删除三段内置渲染器与双分区。
- `src/acp/acp-client.ts`：注入机制不变，仅注释更新（意图来源改为条目自身字段，覆盖同名 env）。
- `src/ui/ChatPanel.tsx`、`src/hooks/useAgentSession.ts`：调用点适配新模型。
- `test/agent-config-boundary.test.ts`：AR-012-1/3/4/5 静态断言（禁旧字段引用、禁 agentId
  注入分支、禁 pi-acp 探测、禁 legacy 迁移代码）。
- `test/session-helpers.test.ts`：既有用例迁移到新模型。

## 偏差与说明

- 执行子代理在实现完成后因连接故障中断，Report 由编排方验收补写；实现本身经
  gate:mr 全绿 + 编排方逐点抽查（类型、注入逻辑、UI 文案、调用点、boundary 断言）
  确认与 Spec/ADR 一致。
- Plan Checkpoint 未触发：`src/acp/` 零机制改动；hooks/ui 连锁修改 2 处文件（远低于 10 处阈值）。
