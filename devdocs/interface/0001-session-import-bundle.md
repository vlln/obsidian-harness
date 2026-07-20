---
title: Interface-0001: Session Import Bundle
description: Harness Session Importer 的 CLI、descriptor、bundle、conversion report、receipt、transaction journal 与错误契约。
type: interface
status: active
created: 2026-07-20T13:46:13Z
---

# Interface-0001: Session Import Bundle

## 一、范围

本接口实现 [Spec-0005](../spec/0005-harness-session-importer.md) 与 [ADR-0006](../adr/0006-session-import-boundary.md) 的文件交接。它不是网络 API，也不是外部 harness 兼容协议。私有来源只出现在 CLI adapter 输入；插件接收的 descriptor、bundle 与 receipt 均为来源无关结构。

## 二、Converter CLI

入口脚本：`$_S/scripts/import_session.py`，其中 `$_S` 由 Agent 替换为 skill 根目录绝对路径。

### 2.1 Inspect

```bash
python3 $_S/scripts/import_session.py inspect \
  --harness <claude|codex|pi|kimi> \
  --session <absolute-source-path> \
  [--branch <source-branch-id>] \
  [--title <display-title>] \
  [--cwd <working-directory>]
```

成功时 stdout 只输出一个 `ConversionReport` JSON，退出码 `0`，不写 vault。`complete=false` 仍是成功 inspect，退出码 `0`；它表示解析完成但需要用户判断降级。

### 2.2 Bundle

```bash
python3 $_S/scripts/import_session.py bundle \
  --harness <claude|codex|pi|kimi> \
  --session <absolute-source-path> \
  --vault <absolute-vault-path> \
  --entry-dir <vault-relative-directory> \
  [--branch <source-branch-id>] \
  [--title <display-title>] \
  [--cwd <working-directory>] \
  [--accept-incomplete]
```

成功时 stdout 输出 `BundleResult` JSON。默认拒绝 `complete=false`；用户已审阅 report 后，Agent 才能传 `--accept-incomplete`。该 flag 只允许发布候选 bundle，插件 materialize 时仍必须再次要求用户确认。

`--vault` 必须是含 `.obsidian/` 的绝对目录。`--entry-dir` 必须是 vault-relative 目录；空字符串或 `.` 表示 vault 根目录。CLI 不接受或读取 Folder Bridge 配置，不扫描默认 harness 历史根目录。

### 2.3 CLI Error

失败时 stdout 为空，stderr 输出一个 `CliError` JSON，退出码 `2`。

```ts
interface CliError {
  schemaVersion: 1;
  code:
    | "source_not_found"
    | "source_invalid"
    | "source_identity_missing"
    | "branch_required"
    | "branch_not_found"
    | "incomplete_not_accepted"
    | "vault_invalid"
    | "vault_boundary_violation"
    | "bundle_write_failed";
  message: string;
  path?: string;
  line?: number;
  branches?: Array<{ id: string; label: string }>;
}
```

## 三、Conversion Report

```ts
interface ConversionReport {
  schemaVersion: 1;
  converterVersion: string;
  source: {
    kind: string; // generic bundle 中是不透明 adapter label
    identity: string;
    branchIdentity: string | null;
    digest: string; // lowercase SHA-256
    files: Array<{ role: string; byteLength: number; sha256: string }>;
  };
  metadata: {
    title: string;
    cwd: string;
    createdAt: string;
  };
  input: {
    records: number;
    recordTypes: Record<string, number>;
  };
  output: {
    turns: number;
    prompts: number;
    assistantMessages: number;
    thoughts: number;
    toolCalls: number;
    toolResults: number;
    blobs: number;
  };
  diagnostics: Array<{
    severity: "info" | "degraded" | "ambiguous";
    code: string;
    sourceType: string;
    count: number;
    message: string;
    semanticImpact: string;
  }>;
  complete: boolean;
  branches: Array<{ id: string; label: string; selected: boolean }>;
  candidate: {
    importId: string;
    entryId: string;
    historyId: string;
    entryFile: string | null; // inspect 时为 null，bundle 时为 vault-relative path
  };
  result: {
    status: "inspected" | "bundle_created" | "bundle_already_exists";
    descriptor: string | null;
  };
}
```

`complete=false` 当且仅当至少一个 `degraded` 或 `ambiguous` diagnostic 影响可见 prompt、assistant content、tool call/result、相对顺序或 turn 最终状态。纯供应商遥测、token streaming、加密 reasoning 和明确重复 transport event 的忽略可记为 `info`，不降低 complete。

## 四、Bundle Result

```ts
interface BundleResult {
  schemaVersion: 1;
  status: "created" | "already_exists";
  descriptor: string; // vault-relative path
  bundleDirectory: string; // vault-relative path
  importId: string;
  sourceDigest: string;
  conversionDigest: string;
  report: ConversionReport;
  wikilink: string;
}
```

相同 descriptor 与 bundle 已存在且所有 digest 相同时返回 `already_exists`，不得更新文件或 mtime。路径存在但 identity/digest 不同时返回 `bundle_write_failed`，不得覆盖。

## 五、Descriptor

文件名固定为 `session-import-<完整 importId>.harness-import`。Materialized entry 文件名固定为 `session-<完整 entryId>.session`，最终路径为 `<entryDir>/session-<entryId>.session`；`entryDir` 为 `.` 或空字符串时直接位于 vault 根目录。

Descriptor 与 bundle 的位置固定为：

```text
descriptor      = join(entryDir, "session-import-<importId>.harness-import")
bundleDirectory = descriptor + ".bundle"
```

两者分别 canonicalize 后必须位于同一显式 vault 内。`bundleDirectory` 不得是 descriptor 的符号链接目标或通过符号链接逃出 vault；descriptor 中保存的 `bundlePath` 必须与上述推导值完全相同。

```ts
interface ImportDescriptor {
  schemaVersion: 1;
  bundlePath: string; // vault-relative *.harness-import.bundle
  manifestSha256: string;
}
```

Descriptor 不包含 turns、receipt、ACP binding 或来源私有 record。`bundlePath` canonicalize 后必须位于同一 vault。

## 六、Bundle Manifest 与布局

```text
session-import-<id>.harness-import.bundle/
├── manifest.json
├── turns.jsonl
├── report.json
└── blobs/
    └── sha256-<digest>
```

```ts
interface ImportBundleManifest {
  schemaVersion: 1;
  importId: string;
  sourceKind: string;
  sourceIdentity: string;
  branchIdentity: string | null;
  sourceDigest: string;
  conversionDigest: string;
  converterVersion: string;
  createdAt: string;
  target: {
    entryDir: string;
    title: string;
    cwd: string;
  };
  transcript: {
    schemaVersion: 2;
    turnsPath: "turns.jsonl";
    blobsPath: "blobs";
  };
  reportPath: "report.json";
}
```

`turns.jsonl` 每行必须是插件当前支持的 v2 `TurnRecord`。大型 rawOutput 已是 v2 `BlobRef`；bundle blob 文件内容必须与 reference 的 SHA-256 和 byteLength 一致。

```ts
interface CanonicalBlobMetadata {
  sha256: string;
  mediaType: string;
  byteLength: number;
  preview: string;
}
```

`conversionDigest` 的 canonical input 是一个对象：`turns` 为按文件顺序解析后的 TurnRecord 数组；`blobs` 为每个唯一 sha256 一项的 `CanonicalBlobMetadata[]` 并按 sha256 升序排列；`report` 只包含 report 的 `output`、`diagnostics`、`complete`、`branches` 字段。多个 BlobRef 使用同一 sha256 时 metadata 必须完全相同，否则 bundle 无效。

所有本文所称 canonical JSON 均指 RFC 8785 JSON Canonicalization Scheme（JCS），输入必须满足 I-JSON：拒绝 duplicate object keys、NaN、Infinity、无法精确互操作的数值和 unpaired Unicode surrogate；不执行 Unicode normalization；对象属性按 RFC 8785 的 UTF-16 code unit 规则排序；字符串转义和数字序列化完全按 JCS。Python converter 内置 JCS serializer，TypeScript validator 使用等价实现，两者必须通过相同 RFC 8785 官方向量与项目 turn/usage/cost 向量后才能用于摘要或 UUIDv5 name。

`sourceDigest` 的 canonical input 是 report `source.files` 中每个参与转换文件的 `{role, byteLength, sha256}`，按 role 升序排列；role 必须由 adapter 在其版本内稳定定义且唯一。Digest 对该数组使用同一 JCS 规则。文件移动不改变 sourceDigest。

## 七、稳定身份与 Entry 路径

Importer identity namespace 固定为：

```text
5ad9d0b0-c511-423c-84d6-64aedca2a19a
```

Identity input 是以下对象的 RFC 8785 JCS UTF-8 字符串，不使用字段字符串拼接：

```ts
interface ImportIdentityInput {
  schemaVersion: 1;
  sourceKind: string;
  sourceIdentity: string;
  branchIdentity: string | null;
}
```

```text
importId  = UUIDv5(fixed namespace, canonical identity input)
entryId   = UUIDv5(importId, "entry")
historyId = UUIDv5(importId, "history")
entryFile = join(entryDir, "session-" + entryId + ".session")
```

所有 UUID 输出为小写标准连字符形式。目标 entryFile 已存在但不是相同 entryId/historyId 时，materializer 返回 `transaction_conflict`，不得覆盖。相同身份是否 no-op 继续由 receipt 的 sourceDigest/conversionDigest 决定。

## 八、Import Receipt

正式路径：`sessions/<historyId>/import-receipt.json`。

```ts
interface ImportReceipt {
  schemaVersion: 1;
  importId: string;
  sourceKind: string;
  sourceIdentity: string;
  branchIdentity: string | null;
  sourceDigest: string;
  conversionDigest: string;
  converterVersion: string;
  complete: boolean;
  degradations: ConversionReport["diagnostics"];
  materializedAt: string;
  entryFile: string;
}
```

`degradations` 保存所有 severity 为 `degraded` 或 `ambiguous` 的 diagnostics；`info` 不进入 receipt。Receipt 不允许 `acpBinding`、backend status 或 raw source payload。

## 九、Transaction Journal

正式路径：`sessions/import-transactions/<importId>.json`。

```ts
interface ImportTransactionJournal {
  schemaVersion: 1;
  transactionId: string;
  importId: string;
  stage: "preparing" | "prepared" | "committed";
  manifestSha256: string;
  sourceDigest: string;
  conversionDigest: string;
  paths: {
    stagingHistory: string; // sessions-relative
    history: string; // sessions-relative
    entryFile: string; // vault-relative
  };
  entryId: string;
  historyId: string;
  createdAt: string;
  updatedAt: string;
}
```

Journal、entry 和 session index 的替换写均采用同目录临时文件后 rename。临时文件名包含 transactionId，recovery 只删除与合法 journal identity 完全匹配的文件。

路径必须满足：

```text
stagingHistory = import-staging/<transactionId>/<historyId>
history        = <historyId>
entryFile      = <vault-relative-entryDir>/session-<entryId>.session
```

`stagingHistory` 和 `history` 相对插件 `sessions/`；`entryFile` 相对 vault。三者均拒绝绝对路径、空 path segment 和 `..`。Recovery 不信任 journal path 字符串：必须从 transactionId/historyId/entryId 重新推导 expected path、与记录值完全比较，并再次 canonicalize 验证边界。只有路径和目标文件内身份都匹配时，才允许删除本 transaction 创建的对象。

## 十、Materializer Result 与错误

```ts
type MaterializeResult =
  | { status: "imported"; entryFile: string; entryId: string; historyId: string }
  | { status: "already_imported"; entryFile: string; entryId: string; historyId: string };

interface ImportError {
  code:
    | "descriptor_invalid"
    | "bundle_missing"
    | "bundle_version_unsupported"
    | "bundle_integrity_mismatch"
    | "incomplete_confirmation_required"
    | "source_changed"
    | "converter_output_changed"
    | "transaction_conflict"
    | "materialize_failed";
  message: string;
  path?: string;
  expected?: string;
  actual?: string;
  existingEntryFile?: string;
}
```

所有错误显示在 `.harness-import` 工作区内。`source_changed`、`converter_output_changed` 和 `transaction_conflict` 不提供覆盖按钮；本轮只能保留既有 history 或由用户另行删除后重新导入。
