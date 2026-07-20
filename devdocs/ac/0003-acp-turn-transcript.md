---
title: AC-0003: ACP Turn Transcript
description: ACP 语义 turn 的离线阅读、持久化、崩溃恢复、续聊状态、schema 门禁与存储失败验收标准。
type: ac
status: active
created: 2026-07-20T09:49:32Z
---

# AC-0003: ACP Turn Transcript

本文件延续项目级验收项编号，从 AC-0007 开始。每个验收项分别覆盖正常、边界、异常和失败场景；外部 harness 私有格式的扫描与转换不在本文件范围内。

## AC-0007: 离线历史阅读

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0007-N-1 | `.session` 指向有效本地 transcript；Agent 未运行 | 打开 `.session` | 完整 prompt、assistant 内容、tool call/result 及 turn 状态按语义顺序显示；没有 Agent 子进程和网络请求 | E2E + 进程/网络断言 |
| AC-0007-B-1 | `.session` 的 cwd 在当前设备不存在 | 打开 `.session` | prompt、assistant 内容和 tool 记录仍可读取；工作目录缺失只影响 continuation 状态 | E2E |
| AC-0007-B-2 | `.session` 或 manifest 的 schema version 为 1 | 打开 `.session` | 工作区显示“unsupported history version 1; requires version 2”；不投影 v1 history、不启动 Agent、不迁移或修改旧文件 | 单元测试 + E2E |
| AC-0007-E-1 | `.session` 含未知的可选字段或 transcript 含未知 item 类型 | 打开 `.session` | 所有已知 item 均被渲染；未知内容显示为 unsupported 占位且保留类型标识 | 单元测试 |
| AC-0007-F-1 | transcript 目录不存在 | 打开 `.session` | 工作区显示“本地历史不可用”及 historyId；不启动 Agent、不显示空白对话冒充有效历史 | E2E |

## AC-0008: 完成 Turn 持久化

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0008-N-1 | ACP turn 正常完成 | 发送 prompt，接收多个 message chunk、tool update 和最终结果 | `turns.jsonl` 只新增一个 `TurnRecord`；prompt 完整；message chunk 已合并；同一 toolCallId 只有最终 snapshot；相对语义顺序保持不变 | 单元测试 |
| AC-0008-B-1 | 一个 turn 含多个 commentary/final message、重复 usage update 或零长度 chunk | 完成 turn | 非空 message 各自保留身份和顺序；usage 只保存最终值；零长度 chunk 不产生 transcript item | 单元测试 |
| AC-0008-E-1 | ACP 返回 error 或 cancel stop reason | 结束 turn | 写入一个 `status=error` 或 `status=cancelled` 的完整 TurnRecord，并保留结束前已聚合内容和可用 stopReason | 单元测试 |
| AC-0008-F-1 | turn 已完成但提交前进程退出 | 重启并打开 history | 不出现伪造的 completed turn；最后 checkpoint 内容以 interrupted 状态可见 | 单元测试 + E2E |

## AC-0009: Active Turn 检查点与中断恢复

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0009-N-1 | ACP turn 持续产生 streaming update | 等待超过 checkpoint 间隔 | `active-turn.json` 被原子覆盖为当前聚合 snapshot；不存在逐 chunk 追加日志 | 单元测试 |
| AC-0009-B-1 | completed TurnRecord 已提交但旧 checkpoint 因退出未删除 | 重启并读取 transcript | 通过相同 turnId 识别旧 checkpoint；该 turn 只显示一次 | 单元测试 |
| AC-0009-E-1 | 存在未提交的有效 `active-turn.json` | 重启并打开 `.session` | checkpoint 内容显示为 `interrupted`；不伪造 endedAt、stopReason 或 completed 状态 | 单元测试 + E2E |
| AC-0009-F-1 | checkpoint 临时文件写入成功但替换失败 | 继续接收更新后重启 | 上一个完整 checkpoint 仍可读取；半写文件不替代它；UI 标明本轮部分内容可能未保存 | 故障注入测试 |

## AC-0010: Continuation 与只读状态

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0010-N-1 | 本地历史有效；ACP binding 和本机 Agent 配置可解析 | 打开 `.session` | 历史立即显示，工作区显示“可继续”；打开动作本身不 spawn Agent；composer 仅在用户明确继续后可发送 | E2E |
| AC-0010-B-1 | 本地历史有效但没有 ACP binding | 打开 `.session` | 显示“只读历史”；composer 隐藏或禁用；不尝试 load/resume/new | E2E |
| AC-0010-E-1 | 有 ACP binding，但 Agent 配置缺失、cwd 缺失或能力不支持恢复 | 打开 `.session` | 历史仍显示；工作区显示“后端不可用”及具体缺失条件；composer 禁用 | E2E |
| AC-0010-F-1 | 用户明确继续后 Agent 进程无法启动 | 执行继续操作 | 状态从 restoring 变为 backend unavailable；历史不消失；不创建新 ACP session | E2E |

## AC-0011: 恢复失败不隐式新建 Session

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0011-N-1 | ACP binding 有效且恢复成功 | 用户明确继续 | 状态依次为 restoring、resumable；后续 prompt 使用原 opaque acpSessionId；historyId 不变 | 集成测试 |
| AC-0011-B-1 | Agent 同时支持 load、resume 和 new | 用户明确继续 | 仅调用设计选择的恢复方法；未调用 newSession | mock 调用断言 |
| AC-0011-E-1 | ACP 返回 session not found 或 capability unsupported | 用户明确继续 | 显示恢复失败原因并保留只读历史；提供独立的“新建会话”用户操作 | 集成测试 |
| AC-0011-F-1 | 恢复请求超时或连接中断 | 等待恢复结束 | 状态退出 restoring；newSession 调用次数为 0；entryId、historyId、acpSessionId 均未被静默替换 | 故障注入测试 |

## AC-0012: 损坏历史与存储写入失败

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0012-N-1 | transcript 文件均合法且存储可写 | 完成一个 turn | blob（如有）先持久化，TurnRecord 后提交，checkpoint 最后清理；重载后内容一致 | 单元测试 |
| AC-0012-B-1 | `turns.jsonl` 有单行损坏，其他行合法 | 打开 history | 每个合法且 turnId 唯一的记录显示一次；损坏行被跳过并在工作区显示持久警告 | 单元测试 + E2E |
| AC-0012-E-1 | manifest 或 `active-turn.json` JSON 损坏 | 打开 history | 尽可能读取有效 TurnRecord；损坏 checkpoint 不参与投影；工作区显示具体损坏文件，不启动 Agent | 单元测试 + E2E |
| AC-0012-F-1 | checkpoint 或 completed turn 写入失败 | Agent turn 仍在运行或刚完成 | 实时 UI 不崩溃且明确标记“历史未保存”；内存聚合和最后有效 checkpoint 不被清除，可重试；不得宣称 turn 已持久化 | 故障注入测试 |

## AC-0013: 大型 Tool Output 引用

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0013-N-1 | tool output 超过实现定义阈值 | 完成 turn | canonical bytes 以 SHA-256 内容地址写入 `blobs/`；TurnRecord 仅保存 hash、mediaType、byteLength 和 preview 引用；渲染内容与原输出一致 | 单元测试 |
| AC-0013-B-1 | 两个 tool output 内容完全相同 | 依次完成两个 turn | 只存一份 blob；两个引用使用同一 hash | 单元测试 |
| AC-0013-E-1 | TurnRecord 引用的 blob 缺失或 hash 校验失败 | 打开 history | 未引用该 blob 的 item 均被渲染；该位置显示包含期望 hash 的 unavailable/corrupt 占位和持久警告 | 单元测试 + E2E |
| AC-0013-F-1 | blob 写入失败 | 提交 completed turn | 不提交引用缺失 blob 的 completed TurnRecord；保留可重试状态并显示“历史未保存” | 故障注入测试 |
