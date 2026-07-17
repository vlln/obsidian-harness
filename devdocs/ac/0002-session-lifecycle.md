---
title: AC-0002: Session 生命周期管理
description: Session 删除清理、索引查询、SessionManagerView 展示的验收标准。
type: ac
status: active
created: 2026-07-17T00:00:00Z
---

# AC-0004: Session 删除清理

验证 .session 文件删除时级联清理索引和 history。

## 正常场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0004-N-1 | session 已创建，有 history 记录 | 1. 在文件浏览器中删除 .session 文件 | session_index.jsonl 中对应条目被删除，sessions/{sessionId}/ 目录被删除 | 自动化 |
| AC-0004-N-2 | session 已创建，无 history 记录 | 1. 删除 .session 文件 | session_index.jsonl 中对应条目被删除，不报错 | 自动化 |

## 边界场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0004-B-1 | .session 文件已被删除但索引条目仍存在（孤儿条目） | 1. 打开 SessionManagerView | 检测到孤儿条目，清理索引 | 自动化 |
| AC-0004-B-2 | 删除的是非 .session 文件 | 1. 删除普通 .md 文件 | 不触发清理逻辑 | 自动化 |

## 异常场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0004-E-1 | history 目录不存在（已被手动删除） | 1. 删除 .session 文件 | 索引条目被删除，不报错（静默处理） | 自动化 |

## 失败场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0004-F-1 | 索引文件不可写 | 1. 删除 .session 文件 | .session 文件被删除，Notice 提示索引清理失败 | Agent 判定 |

---

# AC-0005: SessionManagerView 列表展示

验证 SessionManagerView 展示 session_index 列表。

## 正常场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0005-N-1 | 有多个 session 在不同 cwd | 1. 打开 SessionManagerView | 显示按 cwd 分组的 session 列表 | 自动化 |
| AC-0005-N-2 | 列表中有 session 条目 | 1. 点击 session 条目 | 打开对应 .session 文件的 HarnessSessionView | 自动化 |

## 边界场景

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0005-B-1 | 没有 session 记录 | 1. 打开 SessionManagerView | 显示空状态提示 | 自动化 |
| AC-0005-B-2 | .session 文件已被手动删除（孤儿索引） | 1. 打开 SessionManagerView | 不显示该条目，自动清理索引 | 自动化 |