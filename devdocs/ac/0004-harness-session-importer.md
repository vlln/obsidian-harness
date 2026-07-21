---
title: AC-0004: Harness Session Importer Skill
description: 外部 harness 历史直接转换为标准只读 v2 session 的验收标准。
type: ac
status: active
created: 2026-07-20T13:46:13Z
---

# AC-0004: Harness Session Importer Skill

## AC-0014: 语义转换

| 场景 | 操作 | 预期 |
|------|------|------|
| 四种脱敏 fixture | 分别转换 | prompt、assistant、thought、tool call/result、顺序和 turn 状态符合 fixture，未知遥测不阻断转换。 |
| Codex 双格式消息与尾 prompt | 转换 | 同义消息只保留一次，custom tool 完整关联，尾 prompt 保留为 interrupted。 |
| Claude/Pi 多分支 | 不传/传 `--branch` | 未选择时报可选 branch；选择后只转换目标分支。 |
| 损坏 JSON 或 identity 缺失 | 转换 | 退出码 2，指出文件/行，不写任何 session 文件。 |

## AC-0015: 标准 Session 写入

| 场景 | 操作 | 预期 |
|------|------|------|
| 合法 source 与目标 | 转换 | 直接创建 v2 `.session`、manifest、turns 和 index；插件 reader 无 warning 读回；entry 无 `acpBinding`。 |
| 大型重复 tool output | 转换 | 不截断，只写一个 content-addressed blob，多个 BlobRef 正确复用。 |
| 重复执行 | 再次转换 | 返回 `already_exists`，不创建重复 entry/history/index。 |
| 目标内容冲突 | 转换 | 返回 `target_conflict`，不覆盖既有内容。 |
| entryDir 绝对路径、含 `..` 或符号链接逃逸 | 转换 | 返回 vault boundary 错误，vault 外无写入。 |
| 写入过程中失败 | 转换 | 不发布 `.session` 入口；可识别的临时目录被清理。 |

## AC-0016: 插件边界与只读体验

| 场景 | 操作 | 预期 |
|------|------|------|
| 仓库架构检查 | 扫描 `src/` | Claude/Codex/Pi/Kimi 私有 schema 和 parser 只存在于 skill。 |
| 打开导入 `.session` | Obsidian 加载历史 | 立即渲染本地 transcript，显示 Read-only history，不 spawn/load/resume Agent。 |
