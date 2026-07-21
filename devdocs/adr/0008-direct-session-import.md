---
title: ADR-0008: Companion Skill 直接生成标准 Session
description: 外部 harness 私有格式只存在于 companion skill；脚本直接写 Obsidian Harness 当前标准的只读 session，不引入中间导入协议。
type: adr
status: accepted
created: 2026-07-21T05:30:00Z
---

# ADR-0008: Companion Skill 直接生成标准 Session

## 背景

[ADR-0006](0006-session-import-boundary.md) 把简单的历史转换扩展成了
descriptor、bundle、report、receipt、插件 materializer、确认 UI 与事务恢复协议。
这些能力并非用户需求。当前产品没有外部用户或兼容负担，companion skill 与插件
同仓演进，不需要维护第二套导入生命周期。

用户需要的是：将明确指定的 Claude Code、Codex、Pi Agent 或 Kimi Code 历史，
尽可能保留语义地转换为 Obsidian Harness 已支持的 v2 只读 session。

## 决策

`skills/harness-session-importer/` 直接生成插件当前的标准存储：

```text
<entryDir>/session-<entryId>.session
.obsidian/plugins/obsidian-harness/sessions/
├── session_index.jsonl
└── <historyId>/
    ├── manifest.json
    ├── turns.jsonl
    └── blobs/                 # 仅大型 tool output 需要
```

- `.session` 不包含 `acpBinding`，因此现有插件自然以只读历史打开。
- 私有 source parser 只存在于 companion skill；插件继续只理解 ACP 与自身 v2 格式。
- 脚本不生成 conversion report、receipt、descriptor、bundle 或待确认状态。
- 脚本尽可能映射 prompt、assistant message、thought、tool call/result、顺序与有证据的
  turn 状态。供应商遥测和无法表达的私有控制事件直接忽略。
- 来源有多个真实分支时仍要求显式 `--branch`，避免把互斥历史混成一条对话。
- 来源 session identity 与 branch identity 确定性生成 entry/history/turn/item ID；重复
  执行相同转换返回已有 session，不创建副本。
- 目标存在但内容不同则失败，不覆盖用户已有 session。

## 边界

Folder Bridge、`PJ_*` 与项目笔记路由仍由调用 Agent 决定。脚本只接受显式 source、
vault 和 vault-relative entry directory，不扫描默认历史根目录。

## 后果

导入流程只有一次转换，产物可立即通过 Obsidian wikilink 打开。代价是 converter 与
当前 v2 存储格式直接耦合；这是 companion skill 的预期职责，插件 schema 变化时在同一
仓库和 release 中同步修改即可。
