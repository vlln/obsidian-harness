---
title: Interface-0001: Direct Session Import CLI
description: Harness Session Importer companion skill 的直接转换命令、标准产物与错误契约。
type: interface
status: active
created: 2026-07-20T13:46:13Z
---

# Interface-0001: Direct Session Import CLI

## 命令

```bash
python3 $_S/scripts/import_session.py \
  --harness <claude|codex|pi|kimi> \
  --session <absolute-source-path> \
  --vault <absolute-vault-path> \
  --entry-dir <vault-relative-directory> \
  [--branch <source-branch-id>] \
  [--title <display-title>] \
  [--cwd <working-directory>]
```

`$_S` 由 Agent 替换为 skill 根目录。空 `--entry-dir` 或 `.` 表示 vault 根目录。
命令不读取 Folder Bridge，不扫描默认 harness 历史目录。

## 成功输出

stdout 输出一个 JSON 对象：

```ts
interface ImportResult {
  schemaVersion: 1;
  status: "created" | "already_exists";
  entryId: string;
  historyId: string;
  entryFile: string; // vault-relative
  turns: number;
  wikilink: string;
}
```

产物是插件原生 v2 `.session`、transcript manifest、turns、可选 blobs 和一条
`session_index.jsonl` 记录。`.session` 写入 `acpBinding = { agentId, sessionId }`，其中
`sessionId` 为源生 backend 会话 id、`agentId` 为对应 ACP agent（见
[ADR-0009](../adr/0009-imported-session-continuation.md)）。

## 失败输出

失败时 stdout 为空，stderr 输出 JSON，退出码 `2`：

```ts
interface CliError {
  schemaVersion: 1;
  code:
    | "source_not_found"
    | "source_invalid"
    | "source_identity_missing"
    | "branch_required"
    | "branch_not_found"
    | "vault_invalid"
    | "vault_boundary_violation"
    | "target_conflict"
    | "write_failed";
  message: string;
  path?: string;
  line?: number;
  branches?: Array<{ id: string; label: string }>;
}
```

已存在且身份、entry、manifest、turns 和 blobs 与本次转换一致时返回
`already_exists`。任一既有目标不匹配时返回 `target_conflict`，不得覆盖。
