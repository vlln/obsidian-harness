---
title: AC-0004: Harness Session Importer Skill
description: 外部 harness 语义转换、bundle 校验、幂等冲突、事务恢复与 imported receipt 只读体验的验收标准。
type: ac
status: proposed
created: 2026-07-20T13:46:13Z
---

# AC-0004: Harness Session Importer Skill

本文件延续项目级验收项编号，从 AC-0014 开始。插件核心只验证来源无关 bundle；四种私有 schema 的 fixture 与断言只存在于 skill 测试目录。

## AC-0014: 私有 Session 语义转换

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0014-N-1 | Claude、Codex、Pi、Kimi 各有一份脱敏且正常完成的 golden fixture | 分别执行 dry-run 转换 | report 中 prompt、可见 assistant item、tool call/result、thought 与 turn 数量符合各自 golden expectation；`complete=true`；脚本不写 vault | Python 单元测试 + fixture snapshot |
| AC-0014-B-1 | Codex fixture 同时含 `response_item`/`event_msg` 双格式、nested custom tool call/output、无 assistant 的尾 prompt；Claude/Pi fixture 含多个 leaf/branch | 指定 branch 执行 dry-run | 同义事件只保留一次；所有 custom tool result 完整关联；尾 prompt 以有证据的非 completed 状态保留；只输出所选 branch，其他 branch 计入 report | Python 单元测试 |
| AC-0014-E-1 | 来源含未知 record/content type，或 tool result 找不到对应 call | 执行 dry-run | 可识别内容仍进入 bundle candidate；未知/孤立记录按类型和数量进入 degradations；`complete=false`；不猜测 tool 状态或丢弃且不报告 | Python 单元测试 |
| AC-0014-F-1 | JSONL 有损坏行、来源 session identity 缺失，或多分支但未指定 branch | 执行 dry-run 或正式转换 | 命令非零退出，指出文件/行或可选 branch；不生成 descriptor、bundle、entry、history 或 index | Python 单元测试 |

## AC-0015: 无损 Bundle 与 Vault 边界

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0015-N-1 | dry-run `complete=true`；vault 和相对 entryDir 有效 | 生成 import bundle | 创建轻量 `.harness-import` descriptor 与同名 bundle 目录；manifest、turns、report 和 blob hash 全部通过独立 validator；正式 plugin session storage 未变化 | Python 集成测试 |
| AC-0015-B-1 | tool output 大于 64 KiB，且两个 tool result 内容相同 | 生成 bundle | 输出字节不截断；只生成一个内容寻址 blob；两个 BlobRef 的 SHA-256、byteLength、mediaType 与 preview 合法；`conversionDigest` 可复算 | Python 单元测试 |
| AC-0015-B-2 | 仓库包含 importer skill 与 generic materializer | 执行 architecture boundary test | Claude/Codex/Pi/Kimi schema、默认历史路径和 parser 仅存在于 `skills/harness-session-importer/`；插件 `src/` 只消费 generic bundle；converter CLI 只接受显式 entryDir，不读取 Folder Bridge、PJ 命名或笔记结构 | 静态 architecture test |
| AC-0015-E-1 | entryDir 是绝对路径、含 `..`，或 canonical target 逃出 vault | 生成 bundle | 命令非零退出并显示拒绝的目标；vault 内外均无新 descriptor 或 staging bundle | Python 单元测试 |
| AC-0015-F-1 | bundle 写入、fsync 或最终 rename 任一步失败 | 生成 bundle | 不发布 `.harness-import` descriptor；不保留会被插件识别为有效 bundle 的目录；原 vault 内容不变 | 故障注入测试 |

## AC-0016: Bundle 预览与导入确认

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0016-N-1 | vault 中存在合法 `.harness-import` 与 `complete=true` report | 在 Obsidian 打开 descriptor | 工作区展示来源、turn/tool 计数、目标 entry 和 Import 命令；未确认前不创建 history、receipt、entry 或 index，且不启动 Agent | E2E |
| AC-0016-B-1 | report 为 `complete=false` 且列出两项 degradation | 打开 descriptor 并选择导入 | 两项影响范围持续可见；默认 Import 禁止；用户执行独立的“接受降级并导入”确认后才进入 materialize | E2E |
| AC-0016-E-1 | descriptor/bundle schema version 不支持，或 conversion/blob digest 不匹配 | 打开 descriptor | 工作区显示实际版本或失败 hash；Import 不可用；不修改正式 storage | 单元测试 + E2E |
| AC-0016-F-1 | descriptor 指向缺失 bundle，或读取中 bundle 被删除 | 打开或确认导入 | 工作区显示缺失路径；materialize 不启动或中止；没有部分正式状态 | E2E + 故障注入 |

## AC-0017: 导入身份、幂等与冲突

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0017-N-1 | 合法 bundle 尚未导入 | 确认 Import | 插件从 importId 确定性生成 entryId/historyId；receipt 保存 sourceDigest、conversionDigest、converterVersion 和最终 entryFile；创建一个只读 `.session` | 单元测试 + E2E |
| AC-0017-B-1 | 同一 bundle 已成功导入；第二个 descriptor 指定不同 entryDir | 再次确认 Import | 返回既有 entryFile；entry、history、blob、receipt、index 的字节和 mtime 均不变化；不移动或复制 `.session` | 集成测试 |
| AC-0017-E-1 | importId 相同但 sourceDigest 不同 | 确认 Import | 显示 source-changed conflict 和既有 entryFile；不覆盖任何正式文件 | 单元测试 + E2E |
| AC-0017-F-1 | importId/sourceDigest 相同但 conversionDigest 不同 | 确认 Import | 显示 converter-output-changed conflict；指出现有与候选 converter version/digest；不静默 no-op 或覆盖 | 单元测试 + E2E |

## AC-0018: Materialize 事务与中断恢复

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0018-N-1 | bundle 校验通过且正式目标不存在 | materialize 完成 | blob、history、receipt、entry、index 按协议发布；journal 清除；插件 reader 读回的 turn 与 bundle canonical 内容一致 | 集成测试 |
| AC-0018-B-1 | 同一 importId 的两个确认操作近乎同时触发 | 并发执行 materialize | 插件内串行化同一 importId；只有一组正式身份和一个 index entry；另一次返回同一 entryFile | 并发单元测试 |
| AC-0018-E-1 | blob、history、receipt、entry 或 index 任一发布点后模拟进程退出 | 重载插件并运行 journal recovery | 每个注入点都收敛为完整提交或导入前状态；不存在 entry 指向缺失 history、重复 index 或未被诊断的 orphan receipt | 参数化故障注入 + E2E |
| AC-0018-F-1 | transaction journal 损坏或与现有正式文件身份冲突 | 重载插件 | 不猜测删除或覆盖用户文件；工作区/Notice 显示 journal 路径和冲突身份；新的同 importId 导入被阻止，其他 session 仍可读取 | 故障注入 + E2E |

## AC-0019: Imported History 只读与持久诊断

| 场景编号 | 前置条件 | 操作 | 预期结果 | 验证方式 |
|----------|----------|------|----------|----------|
| AC-0019-N-1 | imported entry、v2 transcript 和 `complete=true` receipt 有效；无 acpBinding | 打开 `.session` | 历史离线渲染，显示“只读历史”和来源 label；composer 禁用或隐藏；不 spawn/load/resume/new Agent | E2E |
| AC-0019-B-1 | receipt 为 `complete=false` 且用户导入时接受了 degradations | 打开 `.session` | 历史正常渲染；工作区持续显示每项 degradation 的类型、数量和影响，不只显示 transient Notice | E2E |
| AC-0019-E-1 | transcript 有效但 receipt 缺失或损坏 | 打开 `.session` | 已知历史仍可读；显示 import provenance unavailable 的持久警告；不推断来源、不启动 Agent | 单元测试 + E2E |
| AC-0019-F-1 | receipt 的 conversionDigest 与正式 transcript/blob canonical 内容不一致 | 打开 `.session` | 已知合法 turn 仍可读；工作区显示 import integrity mismatch 与期望 digest；不把该历史报告为完整，不启动 Agent | 单元测试 + E2E |
