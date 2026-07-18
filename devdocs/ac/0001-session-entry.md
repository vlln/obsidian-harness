---
title: AC-0001: Session 入口文件
description: Session 入口文件的创建、打开、存储的验收标准。
type: ac
status: active
created: 2026-07-15T00:00:00Z
---

# AC-0001: Session 文件创建

验证 .session 文件的创建流程。

## 正常场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0001-N-1 | 插件已启用，vault 已加载 | 1. Cmd+P → "Create new .session file" | vault 中 `Sessions/` 下生成 `session-{uuid前8位}.session` 文件，内容为合法 JSON，包含 version、sessionId、agentId、cwd、title、createdAt、updatedAt、forkedFrom | 自动化 |
| AC-0001-N-2 | 插件已启用 | 1. 创建 .session 文件<br>2. 检查文件内容 | cwd 为 vault 根目录路径；首次打开并初始化后，agentId 回写为实际使用的 Agent ID | 自动化 |

## 边界场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0001-B-1 | 同名 .session 文件已存在 | 1. 创建 .session 文件 | 弹出 Notice 提示文件已存在，不覆盖 | 自动化 |
| AC-0001-B-2 | sessionId 为有效 UUID 格式 | 1. 创建 .session 文件<br>2. 读取 sessionId | sessionId 为 36 字符 UUID 格式 | 自动化 |
| AC-0001-B-3 | 未指定 session 文件位置 | 1. Cmd+P → "Create new .session file" | vault 中 `Sessions/` 下生成 `.session` 文件，cwd 为 vault 根目录路径 | 自动化 |

## 异常场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0001-E-1 | vault 不可写 | 1. 创建 .session 文件 | 弹出 Notice 提示失败，不崩溃 | Agent 判定 |

## 失败场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0001-F-1 | 磁盘空间不足 | 1. 创建 .session 文件 | 弹出 Notice 提示失败，插件保持可用 | Agent 判定 |

---

# AC-0002: Session 文件打开

验证点击 .session 文件打开对话界面的流程。

## 正常场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0002-N-1 | 有效的 .session 文件存在，agent 已配置 | 1. 在文件浏览器中点击 .session 文件 | 打开新 tab，显示 ChatPanel 对话界面，Header 显示 agent 名称 | 自动化 |
| AC-0002-N-2 | .session 文件中 agentId 为已配置 Agent ID | 1. 点击 .session 文件 | ChatPanel 以该 Agent 初始化，cwd 为 .session 中指定的路径 | 自动化 |
| AC-0002-N-3 | .session 文件中 cwd 非空 | 1. 点击 .session 文件 | Agent 的工作目录为 .session 中指定的 cwd | 自动化 |

## 边界场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0002-B-1 | .session 文件内容为空 | 1. 点击空 .session 文件 | 显示 "Invalid session file format" 提示，不崩溃 | 自动化 |
| AC-0002-B-2 | .session 文件 JSON 格式错误 | 1. 点击损坏的 .session 文件 | 显示 "Invalid session file format" 提示，不崩溃 | 自动化 |
| AC-0002-B-3 | .session 文件中 agentId 对应的 agent 未配置 | 1. 点击 .session 文件 | 显示错误提示，不崩溃 | 自动化 |

## 异常场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0002-E-1 | 点击 .session 文件时 agent 进程启动失败 | 1. 点击 .session 文件 | ChatPanel 显示错误状态，提示 agent 连接失败 | 自动化 |

## AC-0006: 统一 Session 落盘

验证所有 session 都通过 `.session` 文件落盘。

| 场景编号 | 前置条件 | 操作 | 期望结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0006-N-1 | 插件已启用 | 1. Cmd+P → "Open chat view" | 创建或打开一个 `Sessions/*.session` 文件，ChatPanel 绑定该文件的 sessionId/cwd/agentId | 自动化 |
| AC-0006-N-2 | Floating chat 已启用 | 1. 打开 floating chat | 创建一个 `Sessions/*.session` 文件，floating ChatPanel 绑定该文件的 sessionId/cwd/agentId | 自动化 |
| AC-0006-N-3 | 任意 session 已发送消息 | 1. 检查插件数据目录 | transcript 写入 `sessions/{sessionId}/main.jsonl` | 自动化 |
| AC-0006-B-1 | `Sessions/` 不存在 | 1. 创建任意 session | 自动创建 `Sessions/` 文件夹并写入 `.session` | 自动化 |

## 失败场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| — | — | — | — | — |

---

# AC-0003: History 追加存储

验证对话历史的追加式 JSONL 存储。

## 正常场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0003-N-1 | session 已连接，agent 已配置 | 1. 发送消息 "hello"<br>2. 等待 agent 回复<br>3. 检查 sessions/{sessionId}/main.jsonl | 文件存在，首行为元数据，后续行包含 user_message_chunk 和 agent_message_chunk 事件 | 自动化 |
| AC-0003-N-2 | session 已存在 history | 1. 发送第二条消息<br>2. 检查 main.jsonl | 新事件追加到文件末尾，原有内容不变 | 自动化 |

## 边界场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0003-B-1 | session 首次对话（sessionId 为新建） | 1. 发送第一条消息 | 创建 sessions/{sessionId}/ 目录和 main.jsonl 文件，首行为元数据 | 自动化 |
| AC-0003-B-2 | session 恢复（sessionId 已存在） | 1. 打开已有 session 的 .session 文件<br>2. 发送消息 | 新事件追加到已有 main.jsonl 末尾 | 自动化 |

## 异常场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0003-E-1 | main.jsonl 文件被外部损坏（中间某行 JSON 不完整） | 1. 读取 main.jsonl | 损坏行之前的内容正常读取，损坏行之后的内容跳过，不崩溃 | 自动化 |

## 失败场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0003-F-1 | 插件目录不可写 | 1. 发送消息 | 对话正常进行（内存中），Notice 提示存储失败 | Agent 判定 |
