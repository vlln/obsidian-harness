---
title: Plan-0057-01: Agent Config Unification
description: 按 Spec-0008/ADR-0012 实现统一 agents[] 配置模型与单一 Agents Settings 分区，交付 AC-0028/AC-0030 单元与集成测试及 AR-012 boundary 检查。
type: plan
status: pending
created: 2026-07-29T05:12:23Z
---

# Plan-0057-01: Agent Config Unification

## Context

v0.6.0 主体需求 BL-0009。契约已冻结：[Spec-0008](../../spec/0008-agent-configuration-unification.md)
（统一 `agents: AgentSettings[]` 模型、单一 Agents 分区 UI、BR-068~075）、
[ADR-0012](../../adr/0012-unified-agent-config-model.md)（约束规则 AR-012-1~5）、
[AC-0007](../../ac/0007-agent-configuration-unification.md)（AC-0028 加载规范化、
AC-0029 设置页 UI、AC-0030 密钥注入）。测试基建已就绪（0055 容器）：
`test/stubs/obsidian.ts` 的 `MemorySecretStorage`（故障注入 + spy）、coverage 白名单已含
`session-helpers.ts`/`settings-normalizer.ts`。

现状要点（实现前必读）：
- 旧模型：`HarnessPluginSettings` 的 `claude`/`codex`/`gemini`/`customAgents` 四字段
  （`src/plugin.ts:116-120`），`DEFAULT_SETTINGS` 三条内置 + pi-acp 探测特例
  （`src/plugin.ts:769-787`），loadSettings 含 legacy apiKey 迁移逻辑（`src/plugin.ts:824-907`）。
- `src/types/agent.ts`：Base + Claude/Codex/Gemini/Custom 五类型。
- `src/services/session-helpers.ts`：`findAgentSettings` 四位查找（:155-187）、
  `buildAgentConfigWithApiKey` 按 agentId 三分支（:198-239）。
- `src/services/settings-normalizer.ts`：已有 `normalizeCustomAgent`、
  `ensureUniqueCustomAgentIds`、`sanitizeArgs`、`normalizeEnvVars`、`toAgentConfig` 纯函数。
- `src/ui/SettingsTab.ts`：`Built-in agents`/`Custom agents` 双分区 + 三段内置渲染器
  （:894-1206）+ custom 渲染器；内置渲染器用 `SecretComponent`、auto-detect 按钮。
- `src/acp/acp-client.ts:208-216`：spawn 前 `secretStorage.getSecret` 注入
  `config.apiKey.{secretId,envVarName}`——机制保留，只改上游意图构建。
- 既有测试 `test/session-helpers.test.ts` 用手写 `HarnessPluginSettings` 字面量，
  需随模型更新。

## Request

TDD 左移实现 Spec-0008 全部内容：

1. **统一类型**（`src/types/agent.ts`）：只保留 `AgentEnvVar` 与统一 `AgentSettings`
   （7 字段，见 Spec §4.1），删除五个旧类型；更新全部引用。
2. **持久化**（`src/plugin.ts`）：settings 改 `agents: AgentSettings[]`；
   `DEFAULT_SETTINGS.agents` 预填四条（Spec §4.3）；loadSettings 走新规范化并**忽略**
   旧 schema 字段（BR-074，删除 legacy apiKey 迁移路径）；`defaultAgentId` 校验回退
   （BR-070）；删除 `getDiscoveredAgents`/`isPiAcpAvailable` 特例（BR-075），
   `getAvailableAgents` 直接映射 `agents[]`；`fallbackAgentId` 等内部引用同步更新。
3. **配置解析**（`src/services/`）：agents[] 规范化抽为 `settings-normalizer.ts` 纯函数
   （字段回退、重复 id 去重、defaultAgentId 解析）；`findAgentSettings` 退化为数组查找；
   `buildAgentConfigWithApiKey` 改为按条目字段判断（BR-072 成对生效、BR-073 注入覆盖同名
   env），禁止 agentId 分支。
4. **Settings UI**（`src/ui/SettingsTab.ts`）：单一 `Agents` 分区，统一编辑器 block
   （Spec §6.1 七字段固定顺序），`Add agent`，任意条目可删（BR-071），空数组空状态
   （§6.3），三处强制文案（AC-0029-N-4）；删除三段内置渲染器与双分区。
5. **AR-012 boundary 检查**：按 `test/session-import-boundary.test.ts` 模式新增
   architecture test，落地 AR-012-1/3/4/5 的静态断言（禁 `settings.claude` 等旧字段引用、
   禁注入逻辑 agentId 分支、禁 pi-acp 探测特例、禁 legacy 迁移代码）。

## Output Format

- 上述 `src/` 变更 + `test/` 单元/集成测试 + boundary test
- AC-0028 与 AC-0030 全部场景标注到具体测试用例（N/B/E/F，测试名或文件中含 AC 编号）
- `npm run gate:mr` 全绿（含 coverage ≥80%）
- Report：AC 验收表（编号 → PASS → 测试用例名 + commit）、diff 摘要、偏差说明；
  AC-0029 标注"SYSTEM_TEST 层，另容器交付"

## Constraints

- 不修改已 active 的 Spec/AC/ADR；发现契约缺陷立即停止上报，不在分支内自行改设计。
- AC-0029 的 WDIO E2E 用例不在本分支（测试执行边界：E2E 属 SYSTEM_TEST）。
- `acp-client.ts` 的 secret 解析/spawn 注入机制不改，只改传入的 config 来源；
  WSL WSLENV 转发逻辑保持不变。
- 密钥值只经 secretStorage 读写；测试与日志中禁止出现密钥明文（AR-012-2）。
- 代码与文档分开 commit；commit message 引用 AC 编号（如 `feat(settings): 实现 AC-0028 统一加载规范化`）。
- demo-vault 与 test/vaults 的旧 schema 配置不迁移（BR-074），如有损坏以新默认值加载为准。

## Checkpoint

以下情况停止并上报：统一模型无法在不改 `src/acp/` 的前提下传入密钥注入意图；
`HarnessPluginSettings` 接口变更导致 hooks/ui 层出现超过 10 处连锁修改（说明模块边界
与 Spec §三不符）；coverage 无法在不凑数的前提下维持 80%。

## Steps

1. 创建分支 `feat/0057-agent-config-unification`。
2. 先写测试：settings-normalizer 新纯函数、session-helpers 查找/注入意图、
   acp-client 注入集成（MemorySecretStorage + env spy）、AR-012 boundary（此时红）。
3. 实现 types → settings-normalizer → plugin.ts → session-helpers → SettingsTab，
   逐层跑通测试；更新 `test/session-helpers.test.ts` 等既有测试到新模型。
4. 全量 `npm run gate:mr` 至全绿。
5. Report + 容器 README 状态表，分开 commit。
