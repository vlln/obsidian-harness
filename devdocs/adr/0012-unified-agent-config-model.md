---
title: ADR-0012: Unified Agent Configuration Model
description: 以单一 agents[] 数组与统一 AgentSettings 类型取代四个分离的内置/自定义配置位，内置后端降级为预填默认条目，API key 成为每个条目的可选 secret 注入能力。
type: adr
status: proposed
created: 2026-07-28T07:42:34Z
---

# ADR-0012: Unified Agent Configuration Model

## 背景

Agent 后端配置目前分散在四个位置：`settings.claude`、`settings.codex`、`settings.gemini`
三个命名字段加 `customAgents[]`，另有 pi-acp 的 `~/.pi/pi-acp` 存在性探测硬编码
（`plugin.ts` `getDiscoveredAgents`、`session-helpers.ts` `findAgentSettings` 特例）。
类型层维护 Base + Claude/Codex/Gemini/Custom 五个类型，三者差异仅是一个
`apiKeySecretId` 字段。UI 层对应三段近乎复制的内置渲染器加一段自定义渲染器。
每新增一个内置后端，需要同步修改类型、默认值、加载规范化、查找逻辑、密钥注入分支和
Settings UI 六处，且内置与自定义的能力不对等（自定义后端无法使用 secretStorage 密钥注入）。

需求来源 [BL-0009](../backlog.md)：所有后端应是一套配置，内置只是方便用户不用主动填写。
项目尚无外部用户，不需要旧 schema 兼容。

## 决策

### 1. 单一 agents[] 存储

`HarnessPluginSettings` 移除 `claude` / `codex` / `gemini` / `customAgents` 四个字段，
新增 `agents: AgentSettings[]`。加载时忽略旧 schema 字段（含 legacy plaintext `apiKey`），
不读取、不迁移、不写回。`agents` 缺失或非法时回退 `DEFAULT_SETTINGS.agents`。

### 2. 统一 AgentSettings 类型

`src/types/agent.ts` 只保留 `AgentEnvVar` 与统一 `AgentSettings`，取代既有五个类型。
`AgentSettings` = `id` / `displayName` / `command` / `args` / `env` /
`apiKeySecretId`（默认 `""`）/ `apiKeyEnvVarName`（默认 `""`）。后两者成对生效，
取代"内置三类型各带一个 apiKeySecretId"的特化设计。

### 3. 内置后端 = 预填默认条目

`DEFAULT_SETTINGS.agents` 预填 Claude Code、Codex、Gemini CLI、Pi 四条（id、command、
args、`apiKeyEnvVarName` 沿用现状值）。加载完成后内置条目与用户添加条目在查找、编辑、
删除上完全同构。pi-acp 的存在性探测门控删除：所有条目始终可见，命令不可用走既有 spawn
错误路径。

### 4. 密钥注入泛化

`buildAgentConfigWithApiKey` 不再按 agentId 分支：任意条目只要 `apiKeySecretId` 与
`apiKeyEnvVarName` 均非空，就在 spawn 前从 Obsidian secretStorage 解析密钥并注入为该
环境变量，注入值覆盖同名手动 `env` 条目。任一字段为空则不注入，后端依赖自身登录态。
密钥值只经 secretStorage 读写，`data.json` 只存 secret 引用。

### 5. 查找与默认后端

`findAgentSettings` 退化为 `agents[]` 数组查找；`defaultAgentId` 必须引用存在条目，
失效时回退首条目，数组为空时为 `""`。`getAvailableAgents` 直接映射 `agents[]`，
删除 discovered/configured 两段拼接逻辑。

## 备选方案

### A. 保留内置命名字段，只统一 UI

数据层不动，SettingsTab 渲染时把四个来源拼成统一列表。否决：查找、密钥注入、
defaultAgentId 校验仍需对四个位置分别分支，复杂度最高的代码没有简化；内置与自定义
能力依旧不对等。

### B. 统一数组，但删除 secretStorage 能力，密钥一律走 env 明文

最简模型，自定义后端现状即如此。否决：`data.json` 明文存密钥是不可接受的安全回退；
内置三后端现有的 Keychain 集成是已发布能力，不能倒退。

### C. 统一数组 + 每个条目可选 secret 注入（采纳）

数组模型解决分散问题，可选 `apiKeySecretId` + `apiKeyEnvVarName` 把内置的密钥能力
泛化到所有条目，同时允许不配置密钥（依赖后端自身登录态）。

### D. 保留旧 schema 迁移层

加载时把 `claude`/`codex`/`gemini`/`customAgents` 搬迁进 `agents[]`。否决：项目无外部
用户，迁移代码及其测试是一次性成本且长期留存在规范化路径中；直接忽略旧字段即可。

## 后果

### 正面

- 新增内置后端只在 `DEFAULT_SETTINGS.agents` 加一行，类型、查找、注入、UI 零改动。
- 任意后端（含自定义）获得 secretStorage 密钥注入能力，内置/自定义能力对等。
- SettingsTab 删除三段重复渲染器（约 270 行），Agents 分区只有一个编辑器。
- pi-acp 等硬编码特例从 `plugin.ts` 与 `session-helpers.ts` 移除。

### 负面

- 旧配置（含已保存的 secretId 引用）静默失效：本机开发环境需在 Settings 中重新选择一次
  API key secret。可接受——无外部用户，且重选成本极低。
- `AgentSettings` 允许 `apiKeyEnvVarName` 被改成任意值，用户可能配出无效注入；由 UI 文案
  与 AC 覆盖，不引入白名单。

## 验证

本 ADR 是数据模型与代码组织约定，不引入新依赖、框架、协议或外部服务：

- secretStorage 读写与 spawn 前环境变量注入是 v0.5.x 已发布的既有机制
  （`acp-client.ts` `initialize()` 中解析 secret 注入），本次只是把按 id 分支改为按字段判断；
- `data.json` 加载规范化沿用既有 `str`/`bool`/`obj` 回退模式，无新序列化格式。

因此属于约定/标准类决策，不需要 spike 验证分支。正确性由 DEVELOP 阶段单元测试
（规范化、查找、注入意图构建）与 SYSTEM_TEST 既有套件保证。

## 约束范围

适用于 `src/types/agent.ts`、`src/plugin.ts`（settings 定义、DEFAULT_SETTINGS、
loadSettings、getAvailableAgents）、`src/services/session-helpers.ts`、
`src/services/settings-normalizer.ts`、`src/ui/SettingsTab.ts` 及引用上述类型的所有调用点。

## 约束规则

| 规则 | 说明 |
|------|------|
| AR-012-1 | `settings.agents` 是唯一配置来源；禁止新增按后端名字的独立 settings 字段 |
| AR-012-2 | 密钥值只允许经 secretStorage 读写；`data.json` 与日志中禁止出现密钥明文 |
| AR-012-3 | 密钥注入逻辑禁止按 agentId 分支；只允许依据条目自身字段判断 |
| AR-012-4 | 禁止恢复任何形式的按后端自动探测特例（如 pi-acp 路径门控） |
| AR-012-5 | 禁止为旧 schema 字段（`claude`/`codex`/`gemini`/`customAgents`/legacy `apiKey`）编写迁移代码 |

## 与既有决策的关系

- [ADR-0001](0001-fork.md)、[ADR-0002](0002-acp-foundation.md)：不变，ACP 层复用边界不受
  settings 模型影响；`src/acp/` 仍是唯一 SDK 依赖位置，本决策只改变传入 spawn 的配置来源。
- [Spec-0008](../spec/0008-agent-configuration-unification.md)：本 ADR 的业务字段、规则与
  UI 约束在该 Spec 中定义，两处不一致时以 Spec 的业务语义为准、以本 ADR 的模型约束为准。
