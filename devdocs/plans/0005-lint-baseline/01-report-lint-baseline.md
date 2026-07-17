---
title: Report-01 Lint Baseline
description: 恢复 npm run lint 质量门禁，并记录 lint 基线修复结果。
type: report
status: complete
created: 2026-07-17T00:00:00Z
---

# Report-01 Lint Baseline

## 实施内容

- `.gitignore` 排除 E2E 运行生成的 Obsidian vault 状态、插件产物和 `.session` 文件，避免工作树持续污染。
- `eslint.config.mjs` 排除 E2E 运行生成物和 `e2e/` 目录；E2E 仍由 `npm run test:e2e` 验证。
- `eslint.config.mjs` 为 `scripts/**/*.mjs` 声明 Node/Web Stream 全局变量，避免 ACP 诊断脚本被浏览器默认环境误伤。
- `SettingsTab` 增加局部 `obsidianmd/ui/sentence-case` 例外，保留 API、CLI、WSL、环境变量等技术文案。
- `SettingsTab` 将多处 `this.display()` 刷新调用集中到 `refresh()` helper，deprecated 例外收敛到单点。
- `plugin.ts` 的 `pi-acp` 可用性检测从 dynamic `require()` 改为 typed Node imports。
- Notice 文案改为 sentence case。
- 修复 `SessionManagerView` floating promise 和 `session-storage.test` unsafe JSON parse。

## 验证结果

| 验证项 | 结果 |
|--------|------|
| `npm run lint` | PASS |
| `npm test` | PASS: 3 files, 69 tests |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS: 5 tests |

## 已知限制

- `SettingsTab` 仍使用 Obsidian `display()` 刷新模型；本轮只把 deprecated lint 例外收敛到 `refresh()` 单点，不重写 SettingsTab 架构。
- `e2e/` 暂不纳入 typed lint；其可靠性由 `npm run test:e2e` 覆盖。
