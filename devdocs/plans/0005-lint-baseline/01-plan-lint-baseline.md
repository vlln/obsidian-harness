---
title: Plan-01 Lint Baseline
description: 恢复 lint 门禁，使其不再被 E2E 生成物、脚本运行环境和既有配置误伤阻断。
type: plan
status: done
created: 2026-07-17T00:00:00Z
---

# Plan-01 Lint Baseline

## Context

`npm run lint` 原本会被 E2E 生成的 Obsidian vault 插件产物、ACP 诊断脚本的 Node/Web Stream 全局变量、E2E typed lint 配置和既有 UI 文案规则阻断。这样 lint 不能作为后续修复的有效信号。

## Request

1. 忽略 E2E 运行生成的 vault 状态和插件产物。
2. 为 `scripts/**/*.mjs` 配置正确的 Node/Web Stream 全局变量。
3. 修复低风险 lint 问题，不改变产品行为。
4. 对 SettingsTab 的技术设置文案保留局部 sentence-case 例外。
5. 让 `npm run lint` 通过。

## Constraints

- 不删除用户或 E2E 生成文件。
- 不把本机开发环境路径写入可提交文档。
- 不在本轮重写 SettingsTab UI 或迁移 Obsidian settings API。

## Checkpoint

- `npm run lint` 通过。
- `npm test` 通过。
- `npm run build` 通过。
- `npm run test:e2e` 通过。
