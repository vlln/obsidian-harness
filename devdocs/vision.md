---
title: Vision — Obsidian Harness 顶层愿景
description: 以 Obsidian 知识库为驾驶舱，ACP Agent 为执行引擎，Session 文件为入口的 AI 工作平台。
type: vision
status: active
created: 2026-07-15T00:00:00Z
---

## 一、业务目标

当前 AI Coding Agent（Codex、Claude Code 等）每个 Session 有独立上下文，知识不共享。但开发工作本身有固定知识、个人/团队习惯和风格。更理想的 Agent 产品应该以知识库为基础，让 Agent Session 可以作为 Obsidian vault 中可打开、可链接、可恢复的工作入口。

Obsidian Harness 解决的核心问题：**让 Agent Session 融入个人知识库，并可从 Obsidian 中恢复继续工作**。以最熟悉的笔记和文本方式管理上下文，IDE 退化为文件查看器，Agent 执行操作，人类始终坐在 Obsidian 这个"驾驶舱"里。

## 二、用户范围

- 使用 Obsidian 管理个人知识库的开发者
- 需要与多个 AI Coding Agent 交互，但厌倦了 session 隔离和上下文丢失
- 希望通过笔记系统组织 Agent 会话入口和相关资料
- 个人开发者和小型团队

## 三、长期理想形态

### Session 入口

Obsidian 作为统一入口，Agent Session 以 vault 文件形式存在。用户可以像管理普通笔记一样移动、链接、搜索和打开 Session 入口。

### 知识网络

Session 文件可被普通笔记引用，形成双向链接，自然融入 Obsidian 的知识体系。

### 跨 Agent 后端

ACP 协议作为中间表示层，Session 存储使用 ACP 格式，实现不同 Agent 后端的迁移。不同 Agent 后端使用 Adapter 转换（如工具映射）。

### 跨设备

Session 传递的目的是"意图和决策"而非"执行痕迹"。当环境上下文变化时，关键结论被提炼为记忆知识，新设备上以此作为上下文继续对话。

## 四、不定义

本文件不定义实现细节、技术选型、接口定义、非功能指标、编码规范。这些分别属于 Spec、ADR、CONTRIBUTING.md。
