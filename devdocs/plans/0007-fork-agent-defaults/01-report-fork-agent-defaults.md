---
title: Report-01 Fork Agent Defaults
description: 记录 fork 版本检查与默认 ACP 后端选择策略修复结果。
type: report
status: complete
created: 2026-07-17T00:00:00Z
---

# Report-01 Fork Agent Defaults

## 实施内容

- 插件更新检查从上游 `RAIT-09/obsidian-agent-client` 改为当前 fork 仓库。
- GitHub release 查询失败时静默返回 `null`，避免无 release 或网络问题制造错误提示。
- 新增 `uniqueNonEmpty()` 和 `selectPreferredDefaultAgentId()`，将默认后端选择策略抽成可测试纯函数。
- `getAvailableAgents()` 将本机检测到的后端放在内置配置后端之前。
- `ensureDefaultAgentId()` 优先选择本机检测到的后端；用户选择了非 fallback 的有效默认后端时保留用户选择。
- `loadSettings()` 会在默认后端被自动调整时持久化设置。
- 单元测试覆盖去重、发现后端优先、用户显式默认保留、无发现后端 fallback。

## 验证结果

| 验证项 | 结果 |
|--------|------|
| `npm test` | PASS: 3 files, 75 tests |
| `npm run build` | PASS |
| `npm run lint` | PASS |
| `npm run test:e2e` | PASS: 5 tests |

## 已知限制

- 当前“可用后端”只包含插件能同步检测到的后端，例如 `pi-acp`。内置 Claude/Codex/Gemini 仍作为配置项展示，但是否能启动仍在实际连接时验证。
- 如果用户确实想把内置 fallback 后端作为默认值，且本机也检测到 `pi-acp`，当前策略会优先 `pi-acp`。后续可增加“锁定默认 agent”设置来区分显式选择和历史默认值。
