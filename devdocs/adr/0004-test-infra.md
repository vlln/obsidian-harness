---
title: ADR-0004: 测试基础设施选型
description: 单元测试使用 vitest，E2E 测试使用 wdio-obsidian-service，CI 使用 GitHub Actions。
type: adr
status: accepted
created: 2026-07-16T00:00:00Z
---

# ADR-0004: 测试基础设施选型

---

## 背景

Obsidian 插件测试需要两套框架：单元测试（纯逻辑、无 Obsidian 依赖）和 E2E 测试（在真实 Obsidian 环境中运行）。当前项目已有 vitest 依赖和 GitHub Actions CI，但缺少 E2E 框架和测试覆盖。

---

## 决策内容

**单元测试使用 vitest，E2E 测试使用 wdio-obsidian-service，CI 使用 GitHub Actions。**

---

## 备选方案

### 单元测试框架

| 方案 | 优点 | 缺点 |
|------|------|------|
| vitest（选择） | 已安装依赖，兼容 Vite/esbuild 生态，速度快 | — |
| jest | 生态成熟 | 需要额外配置，与 esbuild 构建不兼容 |

### E2E 测试框架

| 方案 | 优点 | 缺点 |
|------|------|------|
| wdio-obsidian-service（选择） | 专为 Obsidian 插件设计，支持沙箱 vault、多版本测试、跨平台 | 需要额外配置 WebdriverIO |
| Playwright + 手动 Obsidian 启动 | 灵活 | 需要自己管理 Obsidian 生命周期、沙箱隔离 |
| 手动测试 | 零配置 | 不可自动化、不可 CI |

### CI 平台

| 方案 | 优点 | 缺点 |
|------|------|------|
| GitHub Actions（选择） | 已有配置，免费，与 GitHub 深度集成 | — |

---

## 选择理由

- vitest 已安装且与项目构建体系兼容，无需额外配置
- wdio-obsidian-service 是唯一的 Obsidian 插件 E2E 专用框架，提供沙箱 vault、多版本 Obsidian 下载、插件加载等关键能力
- GitHub Actions 已配置，只需增加测试步骤

---

## 验证

| 验证项 | 复现步骤 | 结论 | 经验 | 验证 Branch |
|--------|---------|------|------|------------|
| vitest 单元测试可运行 | `npm test` → 确认测试通过 | | | ci/0001-test-infra |
| wdio-obsidian-service E2E 框架可启动 | 配置 wdio，运行一个占位用例 → 确认 Obsidian 启动成功 | | | ci/0001-test-infra |
| CI 包含测试步骤 | 提交 MR → 确认 CI 运行 lint + build + test | | | ci/0001-test-infra |

---

## 后果

### 正面

- 自动化测试覆盖，减少手动验证
- E2E 框架可验证 .session 文件创建、打开等关键流程

### 负面

- wdio-obsidian-service 配置复杂，需要下载 Obsidian 二进制文件
- E2E 测试在 CI 中运行较慢

---

## 约束范围

`.github/workflows/ci.yaml`、`test/`、`wdio.conf.ts`、`CONTRIBUTING.md`

---

## 约束规则

| 规则编号 | 规则 | 适用范围 | 违反时如何检出 |
|----------|------|---------|--------------|
| AR-001 | 单元测试使用 vitest，位于 `test/` 目录 | 全部单元测试 | CI 失败 |
| AR-002 | E2E 测试使用 wdio-obsidian-service，位于 `e2e/` 目录 | 全部 E2E 测试 | CI 失败 |
| AR-003 | CI 必须包含 lint + build + test 步骤 | `.github/workflows/ci.yaml` | MR 门禁 |

---

## 修订记录

| 日期 | 修订内容 | 修订原因 |
|------|---------|----------|
| | | |