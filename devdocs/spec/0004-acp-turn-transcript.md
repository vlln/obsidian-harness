---
title: Spec-0004: ACP Turn Transcript
description: 将 ACP 实时事件聚合为可离线阅读的完整 turn 历史，并将本地历史与 ACP 会话恢复能力解耦。
type: spec
status: active
version: 2
created: 2026-07-20T09:39:30Z
---

# Spec-0004: ACP Turn Transcript

## 一、概述

Obsidian Harness 当前将 ACP `SessionUpdate` 流直接追加到 JSONL，并以 ACP backend session ID 同时定位入口、历史和恢复状态。该模型把实时传输、长期历史与后端恢复绑定在一起：历史渲染依赖 streaming chunk 合并，后端不可用时用户难以判断会话是否只能阅读，backend session ID 变化还会影响本地历史身份。

本 Spec 定义下一代本地会话历史：Obsidian Harness 只面向 ACP，将 ACP 实时更新聚合为完整的语义 turn，再持久化为可离线读取的 transcript。ACP 会话恢复是 transcript 之外的可选能力，不再是阅读历史的前提。

本 Spec 生效后，取代 [Spec-0001](0001-session-entry.md) 中 History 存储与 backend session ID 作为 history 定位键的规则，以及 [Spec-0003](0003-session-history.md) 中“恢复失败后自动创建新 ACP session”的降级规则。其余已冻结能力继续有效。

## 二、用户故事

| 编号 | 角色 | 需求 | 目的 | 优先级 |
|------|------|------|------|--------|
| US-010 | 用户 | 在没有 Agent 进程、项目目录或原设备环境时打开 `.session` 并阅读完整历史 | 让 session 成为可同步、可长期保存的知识资产 | P0 |
| US-011 | 用户 | 看到按 turn、消息和工具调用组织的历史，而不是 streaming 片段 | 获得稳定、清晰且不依赖旧渲染算法的阅读体验 | P0 |
| US-012 | 用户 | 明确看到当前 session 是可继续、后端不可用还是只读历史 | 避免把历史可见误解为后端已恢复 | P0 |
| US-013 | 用户 | Obsidian 或 Agent 在长任务中异常退出后仍能看到已产生的内容 | 降低长时间 Agent 工作的过程丢失风险 | P0 |
| US-015 | 用户 | ACP 恢复失败时由自己决定是否开始新会话 | 防止插件静默改变 session 身份或制造错误的“续聊”感知 | P1 |

## 三、模块划分

| 模块 | 提供的能力 | 目录路径 | 优先级 |
|------|-----------|---------|---------|
| Transcript 类型 | 定义完整 turn、消息、thought、tool call、plan、usage 与中断状态的内部领域模型 | `src/types/` | P0 |
| ACP Turn 聚合 | 将当前 turn 内的 ACP prompt、streaming update 与完成结果确定性聚合为语义 snapshot | `src/acp/` + `src/services/` | P0 |
| Transcript 存储 | 管理稳定 history 身份、已完成 turn、活动 turn checkpoint 和大型内容引用 | `src/services/session-storage.ts` 及拆分后的 transcript service | P0 |
| Schema 版本门禁 | 校验 entry 与 transcript schema version，明确拒绝不受支持的开发期格式 | `src/services/` | P0 |
| 历史投影 | 从 transcript 重建 `ChatMessage[]`、tool call 和 plan 等 UI 状态 | `src/services/` + `src/hooks/` | P0 |
| 阅读/恢复状态 UI | 始终先展示本地历史，并独立显示 ACP continuation 的运行时可用性 | `src/ui/` | P0 |

## 四、数据模型

### 4.1 Session Entry

`.session` 是 vault 可见入口，逻辑上包含：

| 字段 | 含义 |
|------|------|
| `entryId` | vault 入口的稳定身份，不随 ACP 生命周期变化 |
| `historyId` | 本地 transcript 的稳定身份，不使用 ACP session ID 代替 |
| `title` / `cwd` | 用户可见标题与项目工作目录 |
| ACP continuation binding | 可选的 Agent 配置标识与不透明 ACP session ID |

`connected`、`imported`、`read-only` 不作为同一个持久化枚举。来源、本地历史存在性、ACP 绑定和当前设备可用性是相互独立的状态。

### 4.2 Transcript Manifest

Manifest 保存 transcript schema 版本、`historyId`、创建/更新时间和当前 session 元数据。它不保存 streaming 事件，也不宣称 ACP 后端当前在线。

### 4.3 Turn Record

一个完成的 turn 至少包含：

| 字段 | 含义 |
|------|------|
| `turnId` | Obsidian Harness 生成的稳定 turn 身份 |
| `startedAt` / `endedAt` | turn 时间边界 |
| `status` | `completed`、`cancelled`、`interrupted` 或 `error` |
| `prompt` | 发给 ACP Agent 的完整 content blocks |
| `items` | 按语义顺序排列的 assistant message、thought、tool call、plan、permission interaction 和 error |
| `stopReason` | ACP prompt 的完成原因（可用时） |
| `usage` / `context` | turn 完成时的最终 usage，以及 model/mode 等必要上下文快照 |

Streaming chunk、重复 usage update 和工具状态的每次临时 patch 不属于已完成 transcript。ACP tool updates 按 `toolCallId` 合并为最终 tool snapshot；多个 commentary/final message 仍保持各自身份和相对顺序。

### 4.4 Active Turn

活动 turn 是当前聚合状态的可覆盖 checkpoint，不是 streaming 日志。它使用与 `TurnRecord` 相同的语义结构，在 turn 完成时提交为不可变记录；异常退出后以 `interrupted` 状态恢复。

### 4.5 Large Content

小型 content block 内联保存。超过实现定义阈值的大型工具输出或资源使用内容寻址引用，确保 turn 记录保持可读且引用对象可校验。

## 五、业务规则

| 规则编号 | 描述 | 约束 |
|----------|------|------|
| BR-010 | 本地历史身份独立于 ACP session ID | `historyId` 创建后保持稳定，load/resume/new 不得改变它 |
| BR-011 | Streaming 仅用于实时 UI | 长期 transcript 不保存 token/chunk 到达过程；只保存聚合后的语义状态 |
| BR-012 | 用户 prompt 必须由 Client 侧记录 | 不假设 ACP Agent 会将 prompt 原样回放 |
| BR-013 | 活动 turn 必须周期性 checkpoint | checkpoint 写入不得阻塞 streaming UI；崩溃后内容按 interrupted 恢复 |
| BR-014 | 历史阅读不启动 ACP Agent | 打开 `.session` 先加载本地 transcript；只读历史不得自动 spawn、load、resume 或 new session |
| BR-015 | Continuation 状态在运行时计算 | 仅当绑定存在、Agent 可用且 ACP 能力允许时，session 才可尝试继续 |
| BR-016 | 恢复失败不得自动创建新会话 | UI 保留本地历史并显示失败；创建新会话必须由用户明确触发 |
| BR-017 | Obsidian Harness 只负责 ACP | 核心代码不扫描或解析 Claude Code、Codex、Pi、Kimi 等私有 history schema |
| BR-018 | v2 不兼容开发期 v1 history | schema version 不匹配时明确拒绝读取；不迁移、不做 legacy projection、不自动修改旧文件 |
| BR-019 | Transcript 只有一个权威表示 | `ChatMessage[]` 是可重建 projection，不作为第二份持久化真相 |

## 六、UI 约束

打开 `.session` 时，界面先渲染本地 transcript，再独立呈现 continuation 状态：

| 状态 | 历史 | Composer | 行为 |
|------|------|----------|------|
| 可继续 | 可读 | 可用 | 用户发送消息时按 ACP binding 继续 |
| 后端不可用 | 可读 | 禁用 | 显示具体缺失条件，不自动创建后端 session |
| 只读历史 | 可读 | 隐藏或禁用 | 明确标记只读，不尝试连接 |
| 正在恢复 | 可读 | 暂时禁用 | 恢复结果不影响已有历史显示 |

状态提示必须出现在会话工作区内，不能只依赖日志或 transient Notice。只读模式下不得显示看似可发送但必然失败的 composer。

## 七、版本边界

1. 本轮是无外部用户的开发期 schema 断代，v2 reader 只读取明确声明为 v2 的 `.session` 与 transcript。
2. v1 `.session` 或 `sessions/{sessionId}/main.jsonl` 不受支持，不提供兼容 reader、自动迁移或 legacy projection。
3. schema version 不受支持时，工作区必须显示实际版本与所需版本；不得启动 Agent、猜测格式或自动修改文件。
4. 现有开发测试数据由开发者手动删除并重新创建，不进入产品代码路径。
5. 外部 harness 历史转换属于未来独立 adapter 工具；若接入，只能直接产出当时受支持的 transcript schema，不改变 obsidian-harness 的后端边界。

## 八、非功能指标

| 维度 | 指标 |
|------|------|
| 离线性 | 读取本地历史不启动 Agent 进程、不访问网络、不要求 cwd 存在 |
| 完整性 | 正常完成的 turn 必须保留 prompt、可见 assistant 内容、tool call/result 顺序与最终状态 |
| 崩溃恢复 | 已写入 active checkpoint 的语义内容在重启后可见，并标记为 interrupted |
| 版本安全 | entry 或 transcript schema version 不受支持时明确失败，不做兼容推断或隐式写入 |
| 可演进性 | 所有持久化实体带 schema version；未知 content 类型不得导致整段历史无法读取 |
| 性能 | streaming 更新不得同步触发 vault 写入；checkpoint 必须合并和限频 |
| 存储 | transcript 不保存 token 级 streaming；大型内容允许外置并通过摘要校验 |

## 九、范围外

- 扫描或解析各 Agent 产品的私有 session storage
- 读取或迁移开发期 v1 `.session` 与 raw `SessionUpdate` history
- 让 imported history 自动恢复到原后端
- 跨 ACP Agent 的真正 session 迁移
- 在 obsidian-harness 中表达后端内部 sub-agent graph
- 保存 token 级 streaming 时序
- 本轮实现“基于此历史新建会话”的上下文蒸馏
