---
title: Spec-0005: Harness Session Importer Skill
description: 通过随 Obsidian Harness 发布的 companion skill，将外部 harness 私有历史直接转换为可离线阅读的标准 v2 session。
type: spec
status: active
version: 3
created: 2026-07-20T13:46:13Z
---

# Spec-0005: Harness Session Importer Skill

## 概述

Importer 是 Obsidian Harness 的配套格式转换 skill，不是 Autowiki 能力，也不是 ACP
兼容层。它读取一个明确指定的 Claude Code、Codex、Pi Agent 或 Kimi Code session，
直接生成 Obsidian Harness 当前可读的 v2 `.session` 与 transcript。

导入结果写入 `acpBinding`（源生 backend session id + 对应 ACP agent id），后端可用时可续聊
恢复真实上下文；后端未配置、cwd 不可用或原生会话已删除时优雅降级，本地历史始终可读。详见
[ADR-0009](../adr/0009-imported-session-continuation.md)。

## 用户故事

| 编号 | 需求 | 目的 | 优先级 |
|------|------|------|--------|
| US-016 | 将一个外部 harness session 转换到指定 vault 目录 | 从项目笔记链接并离线阅读已有过程 | P0 |
| US-017 | 尽可能保留 prompt、回答、thought、工具调用/结果和相对顺序 | 避免历史退化成纯文本摘要 | P0 |
| US-018 | 重复转换同一来源时不创建重复 session | 支持安全重试 | P0 |
| US-019 | 由 Agent 根据项目上下文选择目标目录 | 不把 Folder Bridge/PJ 规则编码进转换器 | P1 |

## 模块

| 模块 | 能力 | 位置 |
|------|------|------|
| Skill workflow | 收集显式 source、vault、entry directory 与必要 branch | `skills/harness-session-importer/SKILL.md` |
| Source adapters | 解析四种私有 schema | `skills/harness-session-importer/scripts/` |
| Semantic converter | 聚合为 v2 `TurnRecord` | `skills/harness-session-importer/scripts/` |
| Standard session writer | 写 `.session`、manifest、turns、blobs 与 index | `skills/harness-session-importer/scripts/` |
| Fixtures/tests | 验证四种 adapter、存储兼容性、幂等和失败边界 | `skills/harness-session-importer/tests/` |

## 业务规则

| 编号 | 规则 |
|------|------|
| BR-020 | 外部 harness 私有 parser 和默认路径不得进入插件 `src/`。 |
| BR-021 | CLI 只转换一个显式 session，不默认扫描历史目录。 |
| BR-022 | 多分支来源必须通过 `--branch` 选择，不合并互斥分支。 |
| BR-023 | 可表达的 prompt、assistant、thought、tool call/result 与顺序尽可能保留；token streaming 和供应商遥测不保留。 |
| BR-024 | 直接生成标准 v2 session；不产生 report、receipt、bundle、descriptor 或 materializer 状态。 |
| BR-025 | 产物写入 `acpBinding = { agentId, sessionId }`，其中 `sessionId` 是源生 backend 会话 id（非导入器算出的 historyId），`agentId` 是对应 ACP agent；使 continuation state 识别为可续聊。后端不可用/会话不存在时由现有 continuation state 优雅降级，本地历史不受影响。 |
| BR-026 | 身份确定且重复转换为 no-op；现有目标内容不匹配时拒绝覆盖。 |
| BR-027 | `entryDir` 必须是 vault-relative 且不得逃出 vault。 |
| BR-028 | 大型工具输出使用 v2 content-addressed BlobRef，不截断内容。 |

## 非目标

- 迁移或复制外部后端 session 数据到 vault（binding 仅记录源生 id，续聊由后端自行 load 原会话）。
- 保证后端会话一定存在（跨设备/删除后走 continuation state 降级，非导入器职责）。
- 在插件中解析 Claude/Codex/Pi/Kimi 私有格式。
- 扫描、归类或批量路由所有本机历史。
- 为转换建立审核、报告或确认工作流。
