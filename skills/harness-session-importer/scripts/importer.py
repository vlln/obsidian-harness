"""AHS → Obsidian Harness session projection and atomic writer.

Native-format parsing is delegated to the harness-adapter library's
``ahs-export`` CLI (Node). This module:
1. Extracts a sessionId from the source path (harness-specific).
2. Calls ``ahs-export`` to project the native session to AHS on disk.
3. Reads the AHS archive (manifest + records/*.jsonl + blobs/).
4. Projects AHS records into Obsidian transcript turns/items.
5. Writes the Obsidian session atomically into the vault.
"""

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import uuid
from dataclasses import dataclass, field
from pathlib import Path


IMPORT_NAMESPACE = "5ad9d0b0-c511-423c-84d6-64aedca2a19a"
BLOB_THRESHOLD = 64 * 1024
FALLBACK_TIMESTAMP = "1970-01-01T00:00:00Z"
TRANSCRIPT_SCHEMA_VERSION = 2

# ACP agent id that can continue each imported source. The binding lets the
# plugin resume the native backend session; unconfigured agents degrade to
# backend_unavailable rather than read_only.
HARNESS_AGENT_ID = {
    "claude-code": "claude-code-acp",
    "codex": "codex-acp",
    "pi": "pi-acp",
    "kimi-code": "kimi-acp",
}

# Old short names → canonical harness-adapter names.
HARNESS_ALIAS = {
    "claude": "claude-code",
    "kimi": "kimi-code",
}


class ImportFailure(Exception):
    def __init__(self, code, message, path=None, line=None, branches=None):
        super().__init__(message)
        self.code = code
        self.path = str(path) if path is not None else None
        self.line = line
        self.branches = branches

    def as_dict(self):
        result = {"schemaVersion": 1, "code": self.code, "message": str(self)}
        if self.path is not None:
            result["path"] = self.path
        if self.line is not None:
            result["line"] = self.line
        if self.branches is not None:
            result["branches"] = self.branches
        return result


@dataclass
class AhsArchive:
    """One AHS session archive on disk (manifest + records + blobs)."""
    manifest: dict
    records: list  # AHS records from the selected branch (file order)
    blobs: dict = field(default_factory=dict)  # sha256 → bytes


@dataclass
class Conversion:
    turns: list
    blobs: dict
    entry_id: str
    history_id: str
    cwd: str
    title: str
    created_at: str
    updated_at: str
    agent_id: str
    source_session_id: str


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _json(value, pretty=False):
    if pretty:
        return json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha(data):
    return hashlib.sha256(data).hexdigest()


def _stable_uuid(namespace, name):
    return str(uuid.uuid5(uuid.UUID(namespace), name))


def _resolve_harness(harness):
    """Map user-facing harness name to canonical harness-adapter name."""
    return HARNESS_ALIAS.get(harness, harness)


# ---------------------------------------------------------------------------
# sessionId extraction (harness-specific, from source path)
# ---------------------------------------------------------------------------

_UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


def _extract_session_id(harness, source):
    """Extract the sessionId from a source path.

    Source files always live in their harness's standard directory, so the
    adapter's default base path discovers them. We only need the sessionId
    to tell ahs-export which session to project.
    """
    harness = _resolve_harness(harness)
    source = Path(source)
    name = source.name

    if harness == "claude-code":
        # ~/.claude/projects/<dir>/<uuid>.jsonl → filename stem
        return source.stem

    if harness == "codex":
        # ~/.codex/sessions/.../rollout-<ts>-<uuid>.jsonl → last UUID in filename
        match = _UUID_RE.search(name)
        if match:
            return match.group()
        return source.stem

    if harness == "pi":
        # ~/.pi/agent/sessions/<dir>/<iso>_<ulid>.jsonl → part after last _
        stem = source.stem
        if "_" in stem:
            return stem.rsplit("_", 1)[-1]
        return stem

    if harness == "kimi-code":
        # ~/.kimi-code/sessions/.../session_<uuid>/ → dir name without prefix
        dirname = source.name
        if dirname.startswith("session_"):
            return dirname[len("session_"):]
        return dirname

    raise ImportFailure("source_invalid", "Unsupported harness: %s" % harness)


# ---------------------------------------------------------------------------
# AHS export (subprocess to harness-adapter CLI)
# ---------------------------------------------------------------------------

def _run_ahs_export(adapter_path, harness, session_id, out_dir):
    """Call ahs-export to project one session to AHS on disk.

    Returns the path to the exported session directory.
    Raises ImportFailure on any error.
    """
    adapter_path = Path(adapter_path)
    export_script = adapter_path / "examples" / "ahs-export.ts"
    if not export_script.is_file():
        raise ImportFailure(
            "adapter_not_found",
            "harness-adapter ahs-export.ts not found",
            export_script,
        )

    cmd = [
        "npx", "vite-node",
        str(export_script),
        harness,
        session_id,
        str(out_dir),
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(adapter_path),
            timeout=120,
        )
    except FileNotFoundError:
        raise ImportFailure(
            "node_not_found",
            "npx/node not found — required to run harness-adapter",
        )
    except subprocess.TimeoutExpired:
        raise ImportFailure(
            "export_timeout",
            "ahs-export did not complete within 120s",
        )

    if result.returncode != 0:
        stderr = result.stderr.strip()
        # Filter out Node experimental warnings.
        stderr_lines = [
            line for line in stderr.splitlines()
            if not line.startswith("(node:")
            and "trace-warnings" not in line
            and line.strip()
        ]
        msg = "\n".join(stderr_lines) if stderr_lines else "ahs-export failed"
        if "session not found" in msg:
            raise ImportFailure(
                "source_not_found",
                "Session not found by adapter: %s" % session_id,
                session_id,
            )
        if "unknown harness" in msg:
            raise ImportFailure(
                "source_invalid",
                "harness-adapter does not recognize: %s" % harness,
            )
        raise ImportFailure("export_failed", msg)

    # Parse stdout: "exported <id>: N records, M blobs → <dir>"
    stdout = result.stdout.strip()
    match = re.search(r"→\s*(.+)$", stdout)
    if not match:
        raise ImportFailure("export_failed", "Could not parse ahs-export output: %s" % stdout)
    return Path(match.group(1).strip())


# ---------------------------------------------------------------------------
# AHS archive reader
# ---------------------------------------------------------------------------

def _read_ahs_archive(session_dir, branch=None):
    """Read an AHS session archive from disk.

    Layout (ADR-0006):
      <session_dir>/manifest.json
      <session_dir>/records/<branch>.jsonl
      <session_dir>/blobs/sha256-<hash>
    """
    session_dir = Path(session_dir)
    manifest_path = session_dir / "manifest.json"
    if not manifest_path.is_file():
        raise ImportFailure("ahs_invalid", "AHS manifest.json not found", manifest_path)

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ImportFailure("ahs_invalid", "Invalid AHS manifest", manifest_path) from error

    # Determine branch: explicit > HEAD > "main"
    if branch is not None:
        branch_name = branch
    else:
        head = manifest.get("HEAD", {})
        branch_name = head.get("branch", "main")

    records_path = session_dir / "records" / ("%s.jsonl" % branch_name)
    if not records_path.is_file():
        # Check available branches for a helpful error.
        records_dir = session_dir / "records"
        if records_dir.is_dir():
            available = sorted(
                f.stem for f in records_dir.glob("*.jsonl")
            )
        else:
            available = []
        raise ImportFailure(
            "branch_not_found",
            "Branch %s not found in AHS archive" % branch_name,
            records_path,
            branches=[{"id": b, "label": b} for b in available],
        )

    records = []
    try:
        with records_path.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, 1):
                if not line.strip():
                    continue
                try:
                    records.append(json.loads(line))
                except (json.JSONDecodeError, UnicodeDecodeError) as error:
                    raise ImportFailure(
                        "ahs_invalid", "Invalid AHS record", records_path, line_number
                    ) from error
    except FileNotFoundError as error:
        raise ImportFailure("ahs_invalid", "AHS records file not found", records_path) from error

    # Read blobs (lazily — only loaded when referenced by a record).
    blobs = {}

    return AhsArchive(manifest=manifest, records=records, blobs=blobs)


def _load_blob(session_dir, sha256):
    """Load a blob file from the AHS archive."""
    blob_path = Path(session_dir) / "blobs" / ("sha256-%s" % sha256)
    if not blob_path.is_file():
        raise ImportFailure("blob_not_found", "Blob not found: %s" % sha256, blob_path)
    return blob_path.read_bytes()


# ---------------------------------------------------------------------------
# AHS → Obsidian transcript projection
# ---------------------------------------------------------------------------

def _map_tool_status(ahs_status):
    """Map AHS tool_call status → Obsidian ToolCallStatus.

    AHS statuses: completed, interrupted, pending, in_progress, error, success
    Obsidian ToolCallStatus: pending | in_progress | completed | failed

    "interrupted" → "failed" (the tool did not complete; showing a spinner
    would imply it's still running, which is wrong for an imported session).
    """
    mapping = {
        "completed": "completed",
        "success": "completed",
        "in_progress": "in_progress",
        "pending": "pending",
        "interrupted": "failed",
        "error": "failed",
    }
    return mapping.get(ahs_status, "completed")


def _tool_kind(name):
    """Derive a ToolKind from the tool name (matches chat.ts ToolKind)."""
    lowered = str(name or "").lower()
    if lowered in {"read", "grep", "glob", "search", "ls", "find"}:
        return "read"
    if lowered in {"write", "edit", "replace", "patch", "apply_patch"}:
        return "edit"
    if lowered in {"bash", "shell", "run", "exec", "exec_command"}:
        return "execute"
    if lowered in {"webfetch", "websearch", "fetch"}:
        return "fetch"
    return "other"


def _content_blocks_to_items(blocks, item_id_factory):
    """Convert AHS ContentBlock[] → Obsidian transcript items.

    text → assistant_message item
    thinking → thought item
    image → (dropped, no Obsidian transcript item type for images)
    blob_ref → assistant_message with preview text
    """
    items = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        btype = block.get("type")
        if btype == "text":
            text = block.get("text", "")
            if text:
                items.append({
                    "type": "assistant_message",
                    "itemId": item_id_factory(),
                    "text": text,
                })
        elif btype == "thinking":
            text = block.get("text", "")
            if text:
                items.append({
                    "type": "thought",
                    "itemId": item_id_factory(),
                    "text": text,
                })
        elif btype == "blob_ref":
            preview = block.get("preview", "")
            if preview:
                items.append({
                    "type": "assistant_message",
                    "itemId": item_id_factory(),
                    "text": preview,
                })
    return items


def _tool_result_content_to_obsidian(content, session_dir, blobs_collected):
    """Convert AHS tool_result content → Obsidian rawOutput.

    AHS tool_result.content is either:
    - a string → wrap as {"content": str} (or blob_ref if oversized)
    - a BlobRef → load blob, externalize

    Returns (raw_output_value, blob_bytes_or_none).
    """
    if isinstance(content, str):
        encoded = _json({"content": content}).encode("utf-8")
        if len(encoded) <= BLOB_THRESHOLD:
            return {"content": content}, None
        digest = _sha(encoded)
        blobs_collected[digest] = encoded
        return {
            "type": "blob_ref",
            "schemaVersion": TRANSCRIPT_SCHEMA_VERSION,
            "sha256": digest,
            "mediaType": "application/json",
            "byteLength": len(encoded),
            "preview": content[:200],
        }, None

    if isinstance(content, dict) and content.get("type") == "blob_ref":
        sha = content.get("sha256", "")
        blob_bytes = _load_blob(session_dir, sha)
        blobs_collected[sha] = blob_bytes
        preview = content.get("preview", "")
        return {
            "type": "blob_ref",
            "schemaVersion": TRANSCRIPT_SCHEMA_VERSION,
            "sha256": sha,
            "mediaType": content.get("mediaType", "text/plain"),
            "byteLength": content.get("byteLength", len(blob_bytes)),
            "preview": preview,
        }, None

    # Fallback: unknown content type, stringify.
    return {"content": str(content)}, None


def _project_ahs_to_turns(archive, session_dir):
    """Project AHS records → Obsidian transcript turns.

    Turn boundaries:
    - AHS turn_boundary (phase=start) begins a new turn.
    - AHS user_message begins a new turn (when no explicit boundary).
    - AHS turn_boundary (phase=end) ends the current turn.
    - If no explicit end boundary, the turn ends at the next turn start
      or at the end of records (status "interrupted").

    Within a turn:
    - user_message → turn prompt (first one) or dropped (subsequent)
    - assistant_message → assistant_message / thought items
    - tool_call → tool item (paired with tool_result by toolCallId)
    - tool_result → attaches to the matching tool item
    - harness_message → assistant_message item (harness-injected)
    - model_change, compaction, goal_update → (dropped, no Obsidian item type)
    """
    records = archive.records
    manifest = archive.manifest

    # Build tool_result lookup by toolCallId (first in file order wins).
    results_by_call_id = {}
    for rec in records:
        if rec.get("type") == "tool_result":
            call_id = rec.get("toolCallId", "")
            if call_id and call_id not in results_by_call_id:
                results_by_call_id[call_id] = rec

    blobs_collected = {}
    turns = []
    current_turn = None
    item_counter = [0]

    def next_item_id():
        item_counter[0] += 1
        return "item-%04d" % item_counter[0]

    def start_turn(prompt_text, timestamp):
        nonlocal current_turn
        if current_turn is not None:
            # Previous turn wasn't explicitly ended — mark interrupted.
            current_turn["status"] = "interrupted"
            turns.append(current_turn)
        current_turn = {
            "schemaVersion": TRANSCRIPT_SCHEMA_VERSION,
            "turnId": "",  # assigned later with stable UUID
            "status": "interrupted",
            "startedAt": timestamp or FALLBACK_TIMESTAMP,
            "prompt": [{"type": "text", "text": prompt_text}] if prompt_text else [],
            "items": [],
        }

    def end_turn(status="completed", timestamp=None, stop_reason=None):
        nonlocal current_turn
        if current_turn is None:
            return
        current_turn["status"] = status
        if timestamp:
            current_turn["endedAt"] = timestamp
        if stop_reason:
            current_turn["stopReason"] = stop_reason
        turns.append(current_turn)
        current_turn = None

    for rec in records:
        rtype = rec.get("type")
        timestamp = rec.get("timestamp", "")

        if rtype == "turn_boundary":
            phase = rec.get("phase")
            if phase == "start":
                # Start a new turn. The prompt will come from the next
                # user_message; if none follows, prompt stays empty.
                start_turn("", timestamp)
            elif phase == "end":
                end_turn("completed", timestamp)
            continue

        if rtype == "user_message":
            content = rec.get("content", [])
            text_parts = []
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    text_parts.append(block.get("text", ""))
                elif isinstance(block, dict) and block.get("type") == "blob_ref":
                    text_parts.append(block.get("preview", ""))
            prompt_text = "\n".join(text_parts)

            if current_turn is None:
                start_turn(prompt_text, timestamp)
            elif not current_turn["prompt"] and prompt_text:
                # First user message in an auto-started turn.
                current_turn["prompt"] = [{"type": "text", "text": prompt_text}]
            else:
                # Subsequent user message within a turn — treat as a new turn.
                start_turn(prompt_text, timestamp)
            continue

        if rtype == "harness_message":
            if current_turn is None:
                start_turn("", timestamp)
            content = rec.get("content", [])
            items = _content_blocks_to_items(content, next_item_id)
            current_turn["items"].extend(items)
            continue

        if rtype == "assistant_message":
            if current_turn is None:
                start_turn("", timestamp)
            content = rec.get("content", [])
            items = _content_blocks_to_items(content, next_item_id)
            current_turn["items"].extend(items)
            # Carry usage if present on this record.
            if "usage" in rec and "usage" not in current_turn:
                current_turn["usage"] = _ahs_usage_to_obsidian(rec["usage"])
            continue

        if rtype == "tool_call":
            if current_turn is None:
                start_turn("", timestamp)
            call_id = rec.get("toolCallId", "")
            name = rec.get("name", "unknown")
            args = rec.get("args")
            ahs_status = rec.get("status", "completed")

            tool_item = {
                "type": "tool",
                "itemId": next_item_id(),
                "toolCallId": call_id,
                "status": _map_tool_status(ahs_status),
                "kind": _tool_kind(name),
                "title": name,
                "rawInput": args if isinstance(args, dict) else {"input": args},
            }

            # Attach paired tool_result.
            result = results_by_call_id.get(call_id)
            if result is not None:
                raw_output, _ = _tool_result_content_to_obsidian(
                    result.get("content"), session_dir, blobs_collected
                )
                tool_item["rawOutput"] = raw_output
                result_status = result.get("status")
                if result_status == "error":
                    tool_item["status"] = "failed"
                elif result_status == "success":
                    tool_item["status"] = "completed"
            # When no paired result, keep the AHS status as-is —
            # "interrupted" maps to "interrupted" (not "in_progress").

            current_turn["items"].append(tool_item)
            continue

        if rtype == "tool_result":
            # Already handled via lookup when processing tool_call.
            # If we encounter a tool_result with no matching tool_call
            # (shouldn't happen per AHS spec), skip it.
            continue

        if rtype == "model_change":
            # No Obsidian transcript item type for model changes.
            # Could be stored in TurnContext.configOptions but that requires
            # SessionConfigOption shape; skip for now.
            continue

        if rtype == "compaction":
            # No Obsidian transcript item type for compaction markers.
            continue

        if rtype == "goal_update":
            # No Obsidian transcript item type for goal updates.
            continue

        # Unknown record type — skip (AHS may add new types).

    # End any dangling turn.
    if current_turn is not None:
        current_turn["status"] = "interrupted"
        turns.append(current_turn)

    return turns, blobs_collected


def _ahs_usage_to_obsidian(usage):
    """Convert AHS Usage → Obsidian SessionUsage.

    AHS Usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens,
                 reasoningTokens, cost: {amount, currency}, durationMs }
    Obsidian SessionUsage: { used, size, cost?: {amount, currency} }

    AHS doesn't have context-window used/size; we synthesize used as the
    sum of input + cacheRead (approximation of context tokens consumed).
    size is unknown → 0.
    """
    if not isinstance(usage, dict):
        return None
    result = {"used": 0, "size": 0}
    input_tokens = usage.get("inputTokens", 0) or 0
    cache_read = usage.get("cacheReadTokens", 0) or 0
    result["used"] = input_tokens + cache_read
    if "cost" in usage and isinstance(usage["cost"], dict):
        result["cost"] = {
            "amount": usage["cost"].get("amount", 0),
            "currency": usage["cost"].get("currency", "USD"),
        }
    return result


# ---------------------------------------------------------------------------
# Conversion orchestration
# ---------------------------------------------------------------------------

def convert_session(harness, source, adapter_path, branch=None, title=None, cwd=None):
    """Convert one external session to an Obsidian Harness Conversion.

    1. Extract sessionId from source path.
    2. Call ahs-export to project to AHS on disk (temp dir).
    3. Read AHS archive.
    4. Project AHS records → Obsidian transcript turns.
    5. Build Conversion with stable IDs.
    """
    harness = _resolve_harness(harness)
    if harness not in HARNESS_AGENT_ID:
        raise ImportFailure("source_invalid", "Unsupported harness: %s" % harness)

    source = Path(source)
    if not source.exists():
        raise ImportFailure("source_not_found", "Source does not exist", source)

    session_id = _extract_session_id(harness, source)

    # Export to AHS in a temp dir.
    ahs_temp = Path(tempfile.mkdtemp(prefix="ahs-export-"))
    try:
        session_dir = _run_ahs_export(adapter_path, harness, session_id, ahs_temp)

        # If multiple branches exist and none was specified, check.
        archive = _read_ahs_archive(session_dir, branch)
        manifest = archive.manifest
        branches = manifest.get("branches", {})
        if branch is None and len(branches) > 1:
            # Multiple branches — require selection.
            head_branch = manifest.get("HEAD", {}).get("branch")
            # Default to HEAD branch (the main/active one).
            branch = head_branch
            # Re-read with the HEAD branch explicitly.
            archive = _read_ahs_archive(session_dir, branch)

        # Project AHS → Obsidian turns.
        turns, blobs = _project_ahs_to_turns(archive, session_dir)

        # Build stable IDs.
        identity_name = _json({
            "branchIdentity": branch,
            "sourceIdentity": session_id,
            "sourceKind": harness,
        })
        import_id = _stable_uuid(IMPORT_NAMESPACE, identity_name)
        entry_id = _stable_uuid(import_id, "entry")
        history_id = _stable_uuid(import_id, "history")

        for turn_index, turn in enumerate(turns):
            turn["turnId"] = _stable_uuid(import_id, "turn:%d" % turn_index)
            for item_index, item in enumerate(turn["items"]):
                item["itemId"] = _stable_uuid(
                    import_id, "turn:%d:item:%d" % (turn_index, item_index)
                )

        # Timestamps from manifest.
        stats = manifest.get("stats", {})
        created_at = _first_timestamp(archive.records) or FALLBACK_TIMESTAMP
        updated_at = _last_timestamp(archive.records) or created_at

        # Metadata from manifest.
        parsed_cwd = manifest.get("cwd", "") or ""
        parsed_title = manifest.get("title", "") or ""

        return Conversion(
            turns=turns,
            blobs=blobs,
            entry_id=entry_id,
            history_id=history_id,
            cwd=cwd if cwd is not None else parsed_cwd,
            title=title or parsed_title or "Untitled",
            created_at=created_at,
            updated_at=updated_at,
            agent_id=HARNESS_AGENT_ID[harness],
            source_session_id=str(session_id),
        )
    finally:
        shutil.rmtree(ahs_temp, ignore_errors=True)


def _first_timestamp(records):
    for rec in records:
        ts = rec.get("timestamp")
        if ts:
            return ts
    return None


def _last_timestamp(records):
    for rec in reversed(records):
        ts = rec.get("timestamp")
        if ts:
            return ts
    return None


# ---------------------------------------------------------------------------
# Atomic session writer (preserved from previous implementation)
# ---------------------------------------------------------------------------

def _inside(root, target):
    try:
        target.relative_to(root)
        return True
    except ValueError:
        return False


def _write_sync(path, content):
    with Path(path).open("wb") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())


def _append_sync(path, content):
    with Path(path).open("ab") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())


def _index_entries(path):
    if not path.exists():
        return []
    entries = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return entries


def _result(status, conversion, entry_file):
    return {
        "schemaVersion": 1,
        "status": status,
        "entryId": conversion.entry_id,
        "historyId": conversion.history_id,
        "entryFile": entry_file,
        "turns": len(conversion.turns),
        "wikilink": "[[%s]]" % entry_file,
    }


def import_session(harness, source, vault, entry_dir, adapter_path,
                   branch=None, title=None, cwd=None):
    vault = Path(vault)
    if not vault.is_absolute() or not (vault / ".obsidian").is_dir():
        raise ImportFailure("vault_invalid", "--vault must be an absolute Obsidian vault", vault)
    entry_path = Path(entry_dir)
    if entry_path.is_absolute() or ".." in entry_path.parts:
        raise ImportFailure(
            "vault_boundary_violation", "entry-dir must stay inside the vault", entry_dir
        )
    root = vault.resolve()
    target = (root / entry_path).resolve()
    if not _inside(root, target):
        raise ImportFailure("vault_boundary_violation", "entry-dir escapes the vault", target)

    conversion = convert_session(harness, source, adapter_path, branch, title, cwd)
    entry_name = "session-%s.session" % conversion.entry_id[:8]
    entry = target / entry_name
    entry_file = entry.relative_to(root).as_posix()
    sessions = root / ".obsidian/plugins/obsidian-harness/sessions"
    history = sessions / conversion.history_id
    index = sessions / "session_index.jsonl"

    entry_data = {
        "version": 2,
        "entryId": conversion.entry_id,
        "historyId": conversion.history_id,
        "agentId": conversion.agent_id,
        "cwd": conversion.cwd,
        "title": conversion.title,
        "createdAt": conversion.created_at,
        "updatedAt": conversion.updated_at,
        "acpBinding": {
            "agentId": conversion.agent_id,
            "sessionId": conversion.source_session_id,
        },
        "forkedFrom": None,
    }
    manifest = {
        "schemaVersion": TRANSCRIPT_SCHEMA_VERSION,
        "historyId": conversion.history_id,
        "createdAt": conversion.created_at,
        "updatedAt": conversion.updated_at,
        "metadata": {
            "agentId": conversion.agent_id,
            "cwd": conversion.cwd,
            "title": conversion.title,
        },
    }
    entry_bytes = _json(entry_data, pretty=True).encode("utf-8")
    manifest_bytes = _json(manifest, pretty=True).encode("utf-8")
    turns_bytes = b"".join(
        (_json(turn) + "\n").encode("utf-8") for turn in conversion.turns
    )
    index_entry = {
        "entryId": conversion.entry_id,
        "historyId": conversion.history_id,
        "cwd": conversion.cwd,
        "entryFile": entry_file,
    }

    existing_index = _index_entries(index)
    identity_entries = [
        item
        for item in existing_index
        if item.get("entryId") == conversion.entry_id
        or item.get("historyId") == conversion.history_id
    ]
    if identity_entries and any(item != index_entry for item in identity_entries):
        raise ImportFailure("target_conflict", "Session index identity already exists", index)

    if entry.exists() or history.exists():
        matches = entry.is_file() and history.is_dir()
        if matches:
            matches = entry.read_bytes() == entry_bytes
            matches = matches and (history / "manifest.json").is_file()
            matches = matches and (history / "manifest.json").read_bytes() == manifest_bytes
            matches = matches and (history / "turns.jsonl").is_file()
            matches = matches and (history / "turns.jsonl").read_bytes() == turns_bytes
            for digest, content in conversion.blobs.items():
                blob = history / "blobs" / ("sha256-%s" % digest)
                matches = matches and blob.is_file() and blob.read_bytes() == content
        if not matches:
            raise ImportFailure("target_conflict", "Standard session target already exists", entry)
        if not identity_entries:
            _append_sync(index, (_json(index_entry) + "\n").encode("utf-8"))
        return _result("already_exists", conversion, entry_file)

    staging = None
    entry_temp = None
    history_published = False
    entry_published = False
    try:
        target.mkdir(parents=True, exist_ok=True)
        sessions.mkdir(parents=True, exist_ok=True)
        staging = Path(tempfile.mkdtemp(prefix=".import-", dir=str(sessions)))
        _write_sync(staging / "manifest.json", manifest_bytes)
        _write_sync(staging / "turns.jsonl", turns_bytes)
        if conversion.blobs:
            (staging / "blobs").mkdir()
            for digest, content in conversion.blobs.items():
                _write_sync(staging / "blobs" / ("sha256-%s" % digest), content)
        os.replace(str(staging), str(history))
        history_published = True
        staging = None

        entry_temp = target / (".%s.%s.tmp" % (entry_name, uuid.uuid4()))
        _write_sync(entry_temp, entry_bytes)
        os.replace(str(entry_temp), str(entry))
        entry_published = True
        entry_temp = None

        _append_sync(index, (_json(index_entry) + "\n").encode("utf-8"))
    except OSError as error:
        if entry_temp is not None and entry_temp.exists():
            entry_temp.unlink()
        if staging is not None and staging.exists():
            shutil.rmtree(staging)
        if entry_published and entry.exists():
            entry.unlink()
        if history_published and history.exists():
            shutil.rmtree(history)
        raise ImportFailure("write_failed", "Failed to write standard session", entry) from error
    return _result("created", conversion, entry_file)
