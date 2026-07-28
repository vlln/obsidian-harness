---
title: "AC-0007: Agent Configuration Unification"
description: 统一 agents[] 配置模型的加载规范化、单一 Agents 分区编辑器与可选 API key secret 注入的验收标准。
type: ac
status: proposed
created: 2026-07-28T07:42:34Z
---

# AC-0007: Agent Configuration Unification

本文件承接 [Spec-0008](../spec/0008-agent-configuration-unification.md) 与
[ADR-0012](../adr/0012-unified-agent-config-model.md)，验收项从 AC-0028 开始。
每个验收项分别覆盖正常、边界、异常和失败场景。

本文件激活后，`settings.claude` / `settings.codex` / `settings.gemini` / `customAgents`
四来源的既有行为预期全部失效，以 `settings.agents` 单一来源为准。

## AC-0028: 统一 agents[] 加载与规范化

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0028-N-1 | 无 `data.json` 或其中无 `agents` 键；`~/.pi/pi-acp` 不存在 | 加载插件设置 | `agents` 为四条内置默认条目：`claude-code-acp`/`codex-acp`/`gemini-cli`/`pi-acp`，command、args、`apiKeyEnvVarName` 与 Spec-0008 §4.3 逐行一致，`apiKeySecretId` 均为 `""`；`defaultAgentId` 为 `claude-code-acp`；按 id 查找四条均可命中；`pi-acp` 条目出现与否不依赖任何路径探测 | Vitest 加载/规范化断言 |
| AC-0028-N-2 | `data.json` 的 `agents` 含一条用户添加条目（含全部字段） | 加载插件设置并枚举可用后端 | 条目按原值加载，与内置条目同构出现在可用后端列表；按 id 查找返回该条目 | Vitest |
| AC-0028-B-1 | `data.json` 的 `agents` 不是数组；或条目缺字段、字段类型错误 | 分别加载 | 非数组时整体回退内置四条；字段级错误逐字段回退默认值（字符串 `""`、数组 `[]`），条目本身保留 | 参数化 Vitest |
| AC-0028-B-2 | `data.json` 的 `agents` 含重复 id | 加载 | 首个条目保留，后续重复项丢弃；其余条目不受影响 | Vitest |
| AC-0028-E-1 | `data.json` 同时含旧 schema 字段（`claude`/`codex`/`gemini`/`customAgents`/legacy plaintext `apiKey`）与新 `agents` | 加载并随后保存一次设置 | 旧字段被忽略，不读取其值、不迁移进 `agents`；保存后的 `data.json` 不含旧字段与密钥明文；不存在任何迁移代码路径 | Vitest + 写回文件断言 + 代码审查 |
| AC-0028-F-1 | `defaultAgentId` 引用不存在的 id；或 `agents` 为空数组 | 分别加载 | 失效引用回退到数组首条目 id；空数组时 `defaultAgentId` 为 `""`，不自动重建内置条目 | Vitest |

## AC-0029: Agents 分区与统一编辑器

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0029-N-1 | 插件设置页已打开，含默认四条内置条目 | 查看 Agents 分区 | 只有一个 `Agents` 分区标题，无 `Built-in agents`/`Custom agents` 标题；每个条目一个编辑器 block，字段顺序固定为 Agent ID（含行尾删除按钮）、Display name、Path（含自动探测按钮）、Arguments、API key（SecretComponent）、API key env var name、Environment variables；末尾有 `Add agent` 主按钮 | WDIO E2E + DOM 结构断言 |
| AC-0029-N-2 | 内置条目 Claude Code 已在编辑器中 | 修改其 Display name、Path、Arguments、Environment variables | 全部即时保存到 `settings.agents` 对应条目；默认后端下拉在 100 ms 内刷新；内置条目与用户条目编辑路径完全相同 | WDIO E2E + settings 断言 |
| AC-0029-N-3 | Agents 分区可见 | 点击 `Add agent`，填写各字段 | 新建空条目并展开编辑；保存后按 id 可查找；默认后端下拉包含新条目 | WDIO E2E |
| AC-0029-N-4 | 编辑器 block 已渲染 | 查看 API key、API key env var name、Environment variables 三个字段的描述文案 | API key 文案说明密钥存于 Obsidian Keychain、不写入 `data.json`；env var name 文案说明该字段为空时不注入；Environment variables 文案明确提示不要在此填写密钥 | WDIO E2E + DOM 文本断言 |
| AC-0029-B-1 | 编辑器中某条目的 Agent ID 被清空 | 触发保存 | 自动生成 `custom-agent-N` 形式的未占用 id，不出现空 id 或重复 id；若该条目是默认后端，`defaultAgentId` 同步指向新 id | Vitest + WDIO E2E |
| AC-0029-B-2 | 当前默认后端条目存在；随后删除全部条目 | 先删除默认条目，再逐一删除剩余条目 | 删除默认条目后 `defaultAgentId` 回退到首条目；全部删除后分区显示紧凑空状态、`Add agent` 可用、`defaultAgentId` 为 `""`、Agent 选择器无选项、不自动重建内置条目 | WDIO E2E + settings 断言 |
| AC-0029-E-1 | 某条目 `command` 为空或指向不可执行路径 | 保存条目并用其启动 Session | 条目按原值持久化到 `settings.agents` 并显示在列表与选择器中；启动时按既有 spawn 错误路径报错，不影响其他条目 | 集成测试 |
| AC-0029-F-1 | 快速连续执行添加与删除操作（含删除刚添加的条目） | 交替点击 `Add agent` 与各条目删除按钮 | 操作全部串行落盘；最终 `agents[]` 与 UI 显示一致，无重复 id、无残留条目、`defaultAgentId` 指向存在条目或为 `""` | WDIO E2E + 最终 settings 断言 |

## AC-0030: API key secret 注入

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0030-N-1 | 任意条目（含用户添加条目）配置了 `apiKeySecretId` 与 `apiKeyEnvVarName`，secretStorage 中存在该 secret | 构建 spawn 配置并启动 Session | 配置携带密钥注入意图（secretId + 该条目自己的 env var name）；spawn 前从 secretStorage 解析并注入为同名环境变量；注入逻辑不按 agentId 分支 | Vitest 意图构建断言 + 集成测试 env spy |
| AC-0030-B-1 | 条目只配置 `apiKeySecretId` 与 `apiKeyEnvVarName` 之一 | 构建 spawn 配置 | 不携带注入意图，不读取 secretStorage；后端依赖自身登录态或手动 `env` | 参数化 Vitest |
| AC-0030-B-2 | 条目手动 `env` 含与 `apiKeyEnvVarName` 同名的条目，且 secret 已配置 | 构建并启动 | 注入值覆盖手动 `env` 同名条目，子进程只收到注入值 | 集成测试 env spy |
| AC-0030-E-1 | `apiKeySecretId` 引用的 secret 已从 Keychain 删除 | 用该条目启动 Session | 按既有密钥缺失错误路径报错；其他条目（含未配密钥的）不受影响 | 故障注入集成测试 |
| AC-0030-F-1 | secretStorage 读取被注入抛错 | 用已配密钥的条目启动 Session，随后检查日志与 `data.json` | spawn 以既有错误语义失败；日志与 `data.json` 中不出现密钥明文，只出现 secretId 引用 | 故障注入集成测试 + 日志/文件断言 |
