---
title: Plan-01 Fork Agent Defaults
description: 修复 fork 版本检查和默认 ACP 后端选择策略。
type: plan
status: done
created: 2026-07-17T00:00:00Z
---

# Plan-01 Fork Agent Defaults

## Context

Obsidian Harness 已从上游 Obsidian Agent Client fork 出独立产品方向。插件运行时仍检查上游 release，导致当前 fork 被提示升级到上游版本。同时，新建 session 在没有明确用户选择时容易落到内置 Claude Code 后端，而没有优先考虑当前环境实际检测到的 ACP 后端。

## Request

1. 插件版本检查不再指向上游仓库。
2. 没有明确用户选择时，优先使用本机检测到的 ACP 后端。
3. 用户已选择非 fallback 默认后端时，保留用户选择。
4. 补单元测试覆盖默认后端选择策略。

## Constraints

- 不引入插件级 Project 概念。
- 不改变 ACP 后端协议或自创中间表示。
- 不把本地测试环境路径写入仓库文档。

## Checkpoint

- `npm test` 通过。
- `npm run build` 通过。
- `npm run lint` 通过。
- `npm run test:e2e` 通过。
