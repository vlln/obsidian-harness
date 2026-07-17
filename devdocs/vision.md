---
title: Vision — Obsidian Harness 顶层愿景
description: 以 Obsidian 知识库为驾驶舱，ACP Agent 为执行引擎，笔记为控制平面的 AI 工作平台。
type: vision
status: active
created: 2026-07-15T00:00:00Z
---

## 一、业务目标

当前 AI Coding Agent（Codex、Claude Code 等）每个 Session 有独立上下文，知识不共享。但开发工作本身有固定知识、个人/团队习惯和风格。更理想的 Agent 产品应该以知识库为基础——每个 Project 或 Session 都可以归入知识库/笔记，实现"把工作本身囊括进笔记系统"。

Obsidian Harness 解决的核心问题：**以个体身份（而非 Project 为中心）解决 Agent 上下文丢失问题**。以最熟悉的笔记和文本方式定义和管理工作，颠覆"IDE 为中心"的开发模式——IDE 退化为文件查看器，Agent 执行操作，人类始终坐在 Obsidian 这个"驾驶舱"里。

## 二、用户范围

- 使用 Obsidian 管理个人知识库的开发者
- 需要与多个 AI Coding Agent 交互，但厌倦了 session 隔离和上下文丢失
- 希望通过笔记系统管理 Prompt、追踪 Agent 执行进度、归档 Agent 产出
- 个人开发者和小型团队

## 三、长期理想形态

### 笔记即控制台

Obsidian 作为统一入口，一切项目从 Obsidian 启动。一个 Project 的 md 文件管理该项目的一切——调研、进度、思考，以及 Agent Session。从笔记直接启动 Coding Agent，Agent 的执行/计划/产出/总结自动或被授权后归入笔记系统。

### 知识网络

Session 文件作为 Obsidian 的一等公民，可被普通笔记引用，形成双向链接，自然融入 Obsidian 的知识体系。Agent 可自主搜索不同权限的知识库内容，获得更详细的背景知识。

### Prompt 和 Workflow 管理

在 Obsidian 中以 Markdown 管理 Prompt 模板，以 Markdown 编排 Agent Workflow 流程。支持项目进度管理 Agent、个人助手 Agent 等元 Agent，根据工作计划调度底层工作 Agent。

### 跨 Agent 后端

ACP 协议作为中间表示层，Session 存储使用 ACP 格式，实现不同 Agent 后端的迁移。不同 Agent 后端使用 Adapter 转换（如工具映射）。

### 跨设备

Session 传递的目的是"意图和决策"而非"执行痕迹"。当环境上下文变化时，关键结论被提炼为记忆知识，新设备上以此作为上下文继续对话。

## 四、不定义

本文件不定义实现细节、技术选型、接口定义、非功能指标、编码规范。这些分别属于 Spec、ADR、CONTRIBUTING.md。