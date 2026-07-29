---
title: "Spec-0008: Agent Configuration Unification"
description: 将所有 Agent 后端统一为单一 agents[] 配置模型（内置后端降级为预填默认条目），并将 Settings 页重组为单一 Agents 分区与统一编辑器。
type: spec
status: active
version: 1
created: 2026-07-28T07:42:34Z
---

# Spec-0008: Agent Configuration Unification

## 一、概述

当前 Agent 后端配置在数据层被切成四个位置：`settings.claude`、`settings.codex`、
`settings.gemini` 三个命名字段加 `customAgents[]`，另有 pi-acp 的自动探测硬编码特例
（`~/.pi/pi-acp` 存在性门控）。UI 层为此维护三段近乎复制的内置后端渲染器
（`renderClaudeSettings` / `renderCodexSettings` / `renderGeminiSettings`）加一段自定义后端
渲染器，每新增一个后端都要同时改类型、默认值、加载规范化、查找逻辑和 UI 五处。

本 Spec 将所有后端统一为单一 `agents: AgentSettings[]` 模型：内置后端（Claude Code、
Codex、Gemini CLI、Pi）只是 `DEFAULT_SETTINGS` 中的预填条目，加载后与用户添加的条目完全
同构、同等呈现。Settings 页重组为单一 `Agents` 分区，所有条目共用同一个编辑器。
API key 改为每个条目的可选能力：配置后存 Obsidian secretStorage 并在 spawn 时注入为指定
环境变量；不配置时依赖后端自身登录态或手动环境变量。

项目尚无外部用户，本 Spec 明确**不提供旧 schema 迁移**；`data.json` 中的旧字段
（`claude` / `codex` / `gemini` / `customAgents` / legacy plaintext `apiKey`）加载时直接忽略。

参考：[Vision](../vision.md)、[BL-0009](../backlog.md)、
[ADR-0012](../adr/0012-unified-agent-config-model.md)。

## 二、用户故事

| 编号 | 角色 | 需求 | 目的 | 优先级 |
|------|------|------|------|--------|
| US-037 | Harness 用户 | 在单一 Agents 分区查看所有后端，内置与自定义同等呈现 | 不再需要在两个分区之间理解"内置"和"自定义"的区别 | P0 |
| US-038 | Harness 用户 | 用同一个编辑器修改任意后端的显示名、命令、参数和环境变量 | 任何后端（含内置）都可以按本机环境调整 | P0 |
| US-039 | Harness 用户 | 为任意后端可选配置 API key，密钥存 Obsidian secretStorage 并以指定环境变量名注入 | 密钥不落盘明文，且自定义后端也能享受内置后端的密钥注入能力 | P0 |
| US-040 | Harness 用户 | 添加新后端或删除任意后端（包括内置预填条目） | 只保留自己真正使用的后端，支持任意 ACP 兼容 Agent | P1 |
| US-041 | Harness 用户 | 不配置 API key 时依赖后端自身登录态（如 `claude login`）工作 | 不为不需要密钥的后端强制要求填写 | P1 |

## 三、模块划分

| 模块 | 提供的能力 | 拥有的数据实体 | 目录路径 | 优先级 |
|------|-----------|----------------|----------|--------|
| Agent Settings Model | 定义统一 `AgentSettings` 类型，取代 Base/Claude/Codex/Gemini/Custom 五个既有类型 | `AgentSettings`（持久化 schema）、`AgentEnvVar` | `src/types/agent.ts` | P0 |
| Agent Settings Persistence | 提供内置默认条目，加载并规范化 `agents[]`，维护 `defaultAgentId` 一致性，忽略旧 schema 字段 | `HarnessPluginSettings.agents`、`HarnessPluginSettings.defaultAgentId` | `src/plugin.ts` | P0 |
| Agent Config Resolution | 按 id 从 `agents[]` 查找配置；构建 spawn 配置并在 secret 字段齐备时附加密钥注入意图 | 无持久化实体 | `src/services/session-helpers.ts` | P0 |
| Agent Settings UI | 渲染单一 Agents 分区与统一编辑器，处理添加、删除与默认后端下拉刷新 | 无持久化实体 | `src/ui/SettingsTab.ts` | P0 |

依赖方向固定为：`SettingsTab` → `plugin.ts` settings；`session-helpers` →
`types/agent` 与 `HarnessPluginSettings`。`types/` 保持零依赖，`src/services/` 不导入
React 与 Obsidian UI 组件；ACP SDK 依赖仍只存在于 `src/acp/`。依赖关系不得反向或成环。

## 四、数据模型

### 4.1 AgentSettings

统一的后端配置类型，持久化于 `data.json` 的 `agents` 数组。取代既有
`BaseAgentSettings`、`ClaudeAgentSettings`、`CodexAgentSettings`、`GeminiAgentSettings`、
`CustomAgentSettings` 五个类型。

| 字段 | 类型 | 约束 | 含义 |
|------|------|------|------|
| `id` | `string` | 数组内唯一，非空 | Session、defaultAgentId 与 lastUsed* 记录引用的稳定标识 |
| `displayName` | `string` | 为空时回退显示 `id` | UI 展示名 |
| `command` | `string` | 允许为空（未配置状态） | 可执行命令名或绝对路径 |
| `args` | `string[]` | 默认 `[]` | 命令行参数 |
| `env` | `AgentEnvVar[]` | 默认 `[]` | 手动环境变量（明文，存 `data.json`） |
| `apiKeySecretId` | `string` | 默认 `""`；仅引用 secretStorage 中的条目 | API key 的 secret 引用，**不是**密钥本身 |
| `apiKeyEnvVarName` | `string` | 默认 `""`；与 `apiKeySecretId` 成对生效 | 密钥注入子进程时使用的环境变量名 |

### 4.2 HarnessPluginSettings 变更

移除 `claude`、`codex`、`gemini`、`customAgents` 四个字段，新增
`agents: AgentSettings[]`。其余字段（`defaultAgentId`、`lastUsedModels` 等）不变，
继续以 agent id 为键引用 `agents[]` 条目。

### 4.3 内置默认条目

`DEFAULT_SETTINGS.agents` 预填四条，与用户添加的条目同构：

| `id` | `displayName` | `command` | `args` | `apiKeyEnvVarName` |
|------|---------------|-----------|--------|--------------------|
| `claude-code-acp` | Claude Code | `claude-agent-acp` | `[]` | `ANTHROPIC_API_KEY` |
| `codex-acp` | Codex | `codex-acp` | `[]` | `OPENAI_API_KEY` |
| `gemini-cli` | Gemini CLI | `gemini` | `["--experimental-acp"]` | `GEMINI_API_KEY` |
| `pi-acp` | Pi | `pi-acp` | `[]` | `""` |

四条默认条目的 `apiKeySecretId` 均为 `""`（未配置）。`pi-acp` 不再附带
`~/.pi/pi-acp` 存在性探测；`defaultAgentId` 默认值保持 `claude-code-acp`。

### 4.4 持久化边界

- 密钥值只存 Obsidian secretStorage；`data.json` 中只出现 `apiKeySecretId` 引用。
- `AgentEnvVar` 是明文字段，UI 必须提示用户不要在 `env` 中填写密钥。
- 旧 schema 字段（`claude` / `codex` / `gemini` / `customAgents` / legacy plaintext
  `apiKey`）在加载时被忽略，不读取、不迁移、不写回。

## 五、业务规则

| 编号 | 描述 | 约束 |
|------|------|------|
| BR-068 | `settings.agents` 是所有 Agent 后端配置的唯一来源 | 内置后端只是 `DEFAULT_SETTINGS` 预填条目；加载完成后内置与用户添加条目在查找、编辑、删除上无差别 |
| BR-069 | Agent `id` 在数组内唯一且非空 | 加载规范化时重复 id 保留首个条目；用户清空 id 时自动生成 `custom-agent-N` 形式的未占用 id |
| BR-070 | `defaultAgentId` 必须引用存在的条目，或在整个数组为空时为 `""` | 加载、删除条目、修改 id 后均重新校验；失效时回退到数组首条目的 id |
| BR-071 | 任意条目（含内置预填条目）均可删除 | 删除当前默认条目时按 BR-070 回退；删除不做确认弹窗以外的额外限制 |
| BR-072 | `apiKeySecretId` 与 `apiKeyEnvVarName` 成对生效 | 仅当两者均非空时，spawn 前从 secretStorage 解析密钥并注入为该环境变量；任一为空则不注入，后端依赖自身登录态或手动 `env` |
| BR-073 | 密钥注入优先于同名手动 `env` 条目 | 注入值覆盖 `env` 中相同名字的条目，保证 UI 配置的密钥生效 |
| BR-074 | 不提供旧 schema 迁移 | 加载时忽略 `claude` / `codex` / `gemini` / `customAgents` / legacy plaintext `apiKey` 字段；项目无外部用户，旧配置静默失效 |
| BR-075 | 移除 pi-acp 自动探测特例 | 不再检查 `~/.pi/pi-acp`；所有条目始终出现在可用后端列表中，命令不可用时按既有 spawn 错误路径报错 |

## 六、UI 约束

### 6.1 Agents 分区结构

- Settings 页只保留一个 `Agents` 分区标题，移除 `Built-in agents` 与
  `Custom agents` 两个分区。
- 每个条目渲染为一个编辑器 block，沿用既有 custom agent block 的视觉样式，字段从上到下
  固定为：
  1. `Agent ID`（文本框 + 行尾删除按钮）
  2. `Display name`
  3. `Path`（命令名或绝对路径，附自动探测按钮）
  4. `Arguments`（每行一个参数）
  5. `API key`（Obsidian `SecretComponent`，从 Keychain 选择或新建 secret）
  6. `API key env var name`（环境变量名，内置条目已预填）
  7. `Environment variables`（每行一个 `KEY=VALUE`）
- 分区末尾提供 `Add agent` 主按钮，新建空条目并展开编辑。
- 不再为单个内置后端渲染独立 heading、安装提示或后端专属文案；安装指引移至用户文档。

### 6.2 编辑器行为

- 所有字段沿用既有 onChange 即时保存语义，保存后刷新默认后端下拉。
- `API key` 字段的值为 secret 引用；控件文案必须说明密钥存于 Obsidian Keychain，
  不会写入 `data.json`。
- `API key env var name` 仅在配置了 `API key` 时有意义；为空时描述文案说明不注入。
- `Environment variables` 描述文案必须提示不要在此填写密钥。
- 删除按钮对任意条目可用；删除后分区与默认后端下拉立即刷新。

### 6.3 空状态

- `agents[]` 为空时分区显示紧凑空状态文案，`Add agent` 保持可用。
- 空数组时 Agent 选择器无选项，不自动重建内置条目。

## 七、错误与边界行为

| 情况 | 行为 |
|------|------|
| `data.json` 含旧 schema 字段 | 静默忽略，按 `agents`（缺省时为内置默认四条）加载；不报错、不迁移 |
| `agents` 数组缺失或不是数组 | 回退到 `DEFAULT_SETTINGS.agents` 的四条内置条目 |
| 条目缺少字段或字段类型错误 | 逐字段回退默认值（字符串回退 `""`、数组回退 `[]`），不丢弃整个条目 |
| 数组内出现重复 id | 保留首个条目，丢弃后续重复项 |
| 删除全部条目 | 允许；分区显示空状态，`defaultAgentId` 为 `""`，Agent 选择器无选项 |
| `apiKeySecretId` 引用的 secret 已被用户从 Keychain 删除 | spawn 时解析失败按既有密钥缺失错误路径报错，不阻断其他后端 |
| 条目 `command` 为空或不可执行 | 条目仍可保存和在列表中显示；启动 Session 时按既有 spawn 错误路径报错 |

## 八、非功能指标

| 维度 | 指标 |
|------|------|
| 数据安全 | `data.json` 中不出现密钥明文；密钥只经 secretStorage 读写 |
| 一致性 | 任何编辑、添加、删除操作后 `defaultAgentId` 与 Agent 选择器在 100 ms 内与 `agents[]` 一致 |
| 可维护性 | 新增一个内置后端只需要在 `DEFAULT_SETTINGS.agents` 增加一个条目，不改类型、查找或 UI 代码 |
| 架构 | `types/` 零依赖；`src/services/` 不导入 React；ACP SDK 依赖仍只存在于 `src/acp/` |
| 兼容性 | 明暗主题下编辑器 block 使用 Obsidian CSS variables，无硬编码颜色 |

## 九、范围外

- 后端的启用/禁用开关（不删除但暂时隐藏）
- 内置默认条目的一键恢复（删除后需手动重新添加）
- 每个后端的模型/模式默认值配置（继续沿用 `lastUsed*` 记录）
- 后端健康检查或版本探测
- 旧 schema 的数据迁移（见 BR-074）

## 十、术语表

| 术语 | 代码标识符 | 定义 |
|------|------------|------|
| Agent Settings | `AgentSettings` | 统一的后端配置类型，内置与自定义条目同构 |
| Built-in Agent | `DEFAULT_SETTINGS.agents` 条目 | 随插件预填的默认后端，加载后无特殊性 |
| Default Agent | `defaultAgentId` | 新建视图默认使用的后端 id；必须引用 `agents[]` 中存在的条目，数组为空时为 `""` |
| Agent Env Var | `AgentEnvVar` | 手动配置的明文环境变量键值对，存于 `data.json`，不得用于填写密钥 |
| API key secret reference | `apiKeySecretId` | 指向 Obsidian secretStorage 条目的引用，非密钥本身 |
| API key env var name | `apiKeyEnvVarName` | 密钥注入子进程时使用的环境变量名 |
| Agent Settings UI | `SettingsTab` Agents 分区 | 单一分区 + 统一编辑器的设置界面 |
