"""Private harness adapters and direct Obsidian Harness session writer."""

import hashlib
import json
import os
import shutil
import tempfile
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


IMPORT_NAMESPACE = "5ad9d0b0-c511-423c-84d6-64aedca2a19a"
BLOB_THRESHOLD = 64 * 1024
FALLBACK_TIMESTAMP = "1970-01-01T00:00:00Z"


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


# ACP agent id that can continue each imported source. The binding lets the
# plugin resume the native backend session; unconfigured agents degrade to
# backend_unavailable rather than read_only.
HARNESS_AGENT_ID = {
    "claude": "claude-code-acp",
    "codex": "codex-acp",
    "pi": "pi-acp",
    "kimi": "kimi-acp",
}


def _json(value, pretty=False):
    if pretty:
        return json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha(data):
    return hashlib.sha256(data).hexdigest()


def _stable_uuid(namespace, name):
    return str(uuid.uuid5(uuid.UUID(namespace), name))


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ImportFailure("source_invalid", "Duplicate object key: %s" % key)
        result[key] = value
    return result


def _read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"), object_pairs_hook=_object)
    except FileNotFoundError as error:
        raise ImportFailure("source_not_found", "Source does not exist", path) from error
    except (json.JSONDecodeError, UnicodeDecodeError, ImportFailure) as error:
        raise ImportFailure("source_invalid", "Invalid JSON source", path) from error


def _read_jsonl(path):
    records = []
    try:
        with Path(path).open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, 1):
                if not line.strip():
                    continue
                try:
                    records.append(json.loads(line, object_pairs_hook=_object))
                except (json.JSONDecodeError, UnicodeDecodeError, ImportFailure) as error:
                    raise ImportFailure(
                        "source_invalid", "Invalid JSONL record", path, line_number
                    ) from error
    except FileNotFoundError as error:
        raise ImportFailure("source_not_found", "Source does not exist", path) from error
    if not records:
        raise ImportFailure("source_invalid", "Source contains no records", path)
    return records


def _timestamp(value):
    if isinstance(value, (int, float)):
        return (
            datetime.fromtimestamp(value / 1000, timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )
    return str(value or "")


def _text(content, accepted=("text", "input_text", "output_text")):
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    return "".join(
        str(part.get("text", ""))
        for part in content
        if isinstance(part, dict) and part.get("type") in accepted
    )


def _kind(name):
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


class Builder:
    def __init__(self):
        self.turns = []
        self.current = None
        self._item = 0
        self._turn = 0

    def prompt(self, text, timestamp):
        self.finish("interrupted")
        self._turn += 1
        self.current = {
            "schemaVersion": 2,
            "turnId": "turn-%04d" % self._turn,
            "status": "interrupted",
            "startedAt": _timestamp(timestamp) or FALLBACK_TIMESTAMP,
            "prompt": [{"type": "text", "text": text}],
            "items": [],
        }

    def _id(self):
        self._item += 1
        return "item-%04d" % self._item

    def message(self, text):
        if self.current is not None and text:
            self.current["items"].append(
                {"type": "assistant_message", "itemId": self._id(), "text": text}
            )

    def thought(self, text):
        if self.current is not None and text:
            self.current["items"].append(
                {"type": "thought", "itemId": self._id(), "text": text}
            )

    def tool(self, call_id, name, arguments):
        if self.current is None:
            return
        self.current["items"].append(
            {
                "type": "tool",
                "itemId": self._id(),
                "toolCallId": str(call_id),
                "status": "in_progress",
                "kind": _kind(name),
                "title": str(name or "unknown"),
                "rawInput": arguments
                if isinstance(arguments, dict)
                else {"input": arguments},
            }
        )

    def result(self, call_id, output, failed=False):
        if self.current is None:
            return
        for item in reversed(self.current["items"]):
            if item["type"] == "tool" and item["toolCallId"] == str(call_id):
                item["status"] = "failed" if failed else "completed"
                item["rawOutput"] = output if isinstance(output, dict) else {"content": output}
                return
        self.current["items"].append(
            {
                "type": "tool",
                "itemId": self._id(),
                "toolCallId": str(call_id or "unmatched"),
                "status": "failed" if failed else "completed",
                "kind": "other",
                "title": "Unmatched tool result",
                "rawOutput": output if isinstance(output, dict) else {"content": output},
            }
        )

    def finish(self, status="completed", timestamp=None, stop_reason=None):
        if self.current is None:
            return
        self.current["status"] = status
        if timestamp:
            self.current["endedAt"] = _timestamp(timestamp)
        if stop_reason:
            self.current["stopReason"] = stop_reason
        self.turns.append(self.current)
        self.current = None

    def done(self):
        self.finish("interrupted")
        return self.turns


def _select_chain(records, id_key, parent_key, branch, leaf_types=None, leaf_roles=None):
    nodes = {record.get(id_key): record for record in records if record.get(id_key)}
    parent_ids = {record.get(parent_key) for record in records if record.get(parent_key)}
    global_leaves = [node_id for node_id in nodes if node_id not in parent_ids]
    leaves = []
    for node_id in global_leaves:
        candidate = node_id
        seen = set()
        while candidate in nodes and candidate not in seen:
            seen.add(candidate)
            record = nodes[candidate]
            role = record.get("message", {}).get("role")
            if (leaf_types is None or record.get("type") in leaf_types) and (
                leaf_roles is None or role in leaf_roles
            ):
                leaves.append(candidate)
                break
            candidate = record.get(parent_key)
    leaves = list(dict.fromkeys(leaves))
    choices = [{"id": leaf, "label": leaf} for leaf in leaves]
    if len(leaves) > 1 and branch is None:
        raise ImportFailure(
            "branch_required", "Multiple branches require --branch", branches=choices
        )
    selected = branch or (leaves[0] if leaves else None)
    if selected not in nodes:
        raise ImportFailure(
            "branch_not_found", "Selected branch does not exist", branches=choices
        )
    chain = []
    seen = set()
    while selected and selected in nodes and selected not in seen:
        seen.add(selected)
        record = nodes[selected]
        chain.append(record)
        selected = record.get(parent_key)
    chain.reverse()
    return chain


def _parse_claude(path, branch):
    records = _read_jsonl(path)
    identity = next((item.get("sessionId") for item in records if item.get("sessionId")), None)
    if not identity:
        raise ImportFailure("source_identity_missing", "Claude session identity is missing", path)
    chain = _select_chain(records, "uuid", "parentUuid", branch, {"user", "assistant"})
    builder = Builder()
    cwd = next((item.get("cwd") for item in records if item.get("cwd")), "")
    title = "Untitled"
    for record in chain:
        kind = record.get("type")
        message = record.get("message", {})
        content = message.get("content", "")
        timestamp = record.get("timestamp", "")
        if kind == "user" and isinstance(content, str):
            if title == "Untitled":
                title = content[:80]
            builder.prompt(content, timestamp)
        elif kind == "user" and isinstance(content, list):
            for part in content:
                if part.get("type") == "tool_result":
                    builder.result(
                        part.get("tool_use_id"),
                        part.get("content", ""),
                        part.get("is_error", False),
                    )
        elif kind == "assistant":
            for part in content if isinstance(content, list) else []:
                part_type = part.get("type")
                if part_type == "thinking":
                    builder.thought(part.get("thinking", ""))
                elif part_type == "text":
                    builder.message(part.get("text", ""))
                elif part_type == "tool_use":
                    builder.tool(part.get("id"), part.get("name"), part.get("input", {}))
            stop = message.get("stop_reason") or message.get("stopReason")
            if stop in {"end_turn", "stop", "max_tokens"}:
                builder.finish("completed", timestamp, stop)
    return builder, identity, branch, cwd, title, records


def _parse_pi(path, branch):
    records = _read_jsonl(path)
    header = next((item for item in records if item.get("type") == "session"), None)
    identity = header.get("id") if header else None
    if not identity:
        raise ImportFailure("source_identity_missing", "Pi session identity is missing", path)
    messages = [item for item in records if item.get("type") == "message"]
    chain = _select_chain(messages, "id", "parentId", branch, leaf_roles={"user", "assistant"})
    chain_ids = {item.get("id") for item in chain}
    selected_calls = {
        part.get("id")
        for item in chain
        for part in item.get("message", {}).get("content", [])
        if isinstance(part, dict) and part.get("type") == "toolCall"
    }
    sibling_results = [
        item
        for item in messages
        if item.get("id") not in chain_ids
        and item.get("message", {}).get("role") == "toolResult"
        and item.get("message", {}).get("toolCallId") in selected_calls
    ]
    positions = {id(item): index for index, item in enumerate(records)}
    chain = sorted(chain + sibling_results, key=lambda item: positions[id(item)])
    builder = Builder()
    title = "Untitled"
    for record in chain:
        message = record.get("message", {})
        role = message.get("role")
        content = message.get("content", [])
        timestamp = record.get("timestamp", "")
        if role == "user":
            prompt = _text(content)
            if title == "Untitled":
                title = prompt[:80]
            builder.prompt(prompt, timestamp)
        elif role == "assistant":
            for part in content:
                part_type = part.get("type")
                if part_type == "thinking":
                    builder.thought(part.get("thinking", ""))
                elif part_type == "text":
                    builder.message(part.get("text", ""))
                elif part_type == "toolCall":
                    builder.tool(part.get("id"), part.get("name"), part.get("arguments", {}))
            stop = message.get("stopReason")
            if stop in {"stop", "end_turn", "maxTokens"}:
                builder.finish("completed", timestamp, stop)
        elif role == "toolResult":
            builder.result(
                message.get("toolCallId"),
                _text(content),
                message.get("isError", False),
            )
    return builder, identity, branch, header.get("cwd", ""), title, records


def _arguments(value):
    if not isinstance(value, str):
        return value if isinstance(value, dict) else {"input": value}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {"input": parsed}
    except json.JSONDecodeError:
        return {"input": value}


def _parse_codex(path, branch):
    if branch is not None:
        raise ImportFailure("branch_not_found", "Codex source has no selectable branch")
    records = _read_jsonl(path)
    meta = next(
        (item.get("payload", {}) for item in records if item.get("type") == "session_meta"),
        {},
    )
    identity = meta.get("id") or meta.get("session_id")
    if not identity:
        raise ImportFailure("source_identity_missing", "Codex session identity is missing", path)
    builder = Builder()
    title = "Untitled"
    response_messages = {}
    pending_event_messages = []
    for record in records:
        record_type = record.get("type")
        payload = record.get("payload", {})
        timestamp = record.get("timestamp", "")
        payload_type = payload.get("type")
        if record_type == "response_item" and payload_type == "message":
            role = payload.get("role")
            text = _text(payload.get("content", []))
            if role == "user":
                if title == "Untitled":
                    title = text[:80]
                builder.prompt(text, timestamp)
            elif role == "assistant":
                response_messages[text] = response_messages.get(text, 0) + 1
                if text in pending_event_messages:
                    pending_event_messages.remove(text)
                else:
                    builder.message(text)
        elif record_type == "event_msg" and payload_type == "agent_message":
            text = payload.get("message", "")
            if response_messages.get(text, 0):
                response_messages[text] -= 1
            else:
                builder.message(text)
                pending_event_messages.append(text)
        elif record_type == "response_item" and payload_type in {
            "function_call",
            "custom_tool_call",
        }:
            builder.tool(
                payload.get("call_id") or payload.get("id"),
                payload.get("name"),
                _arguments(payload.get("arguments", payload.get("input", {}))),
            )
        elif record_type == "response_item" and payload_type in {
            "function_call_output",
            "custom_tool_call_output",
        }:
            builder.result(
                payload.get("call_id"),
                payload.get("output", payload.get("result", "")),
                payload.get("is_error", False),
            )
        elif record_type in {"function_call", "custom_tool_call"}:
            builder.tool(
                payload.get("call_id") or payload.get("id"),
                payload.get("name"),
                _arguments(payload.get("arguments", payload.get("input", {}))),
            )
        elif record_type in {"function_call_output", "custom_tool_call_output"}:
            builder.result(
                payload.get("call_id"),
                payload.get("output", payload.get("result", "")),
                payload.get("is_error", False),
            )
        elif (
            record_type == "event_msg"
            and payload_type in {"task_complete", "turn_complete"}
        ) or record_type == "task_complete":
            builder.finish("completed", timestamp, payload.get("stop_reason") or "end_turn")
    return builder, identity, None, meta.get("cwd", ""), title, records


def _parse_kimi(path, branch):
    directory = Path(path)
    state_path = directory / "state.json"
    state = _read_json(state_path)
    directory_identity = directory.name[8:] if directory.name.startswith("session_") else None
    identity = state.get("session_id") or state.get("id") or directory_identity
    if not identity:
        raise ImportFailure("source_identity_missing", "Kimi session identity is missing", state_path)
    root_wire = directory / "wire.jsonl"
    if root_wire.exists():
        wires = {"main": root_wire}
    else:
        wires = {
            item.parent.name: item
            for item in sorted((directory / "agents").glob("*/wire.jsonl"))
        }
    choices = [{"id": name, "label": name} for name in wires]
    if len(wires) > 1 and branch is None:
        raise ImportFailure(
            "branch_required", "Multiple Kimi agents require --branch", branches=choices
        )
    selected = branch or (next(iter(wires)) if wires else None)
    if selected not in wires:
        raise ImportFailure(
            "branch_not_found", "Selected Kimi agent does not exist", branches=choices
        )
    records = _read_jsonl(wires[selected])
    builder = Builder()
    title = "Untitled"
    for record in records:
        record_type = record.get("type") or record.get("method")
        timestamp = record.get("time") or record.get("timestamp", "")
        if record_type == "turn.prompt":
            prompt = _text(
                record.get("content", record.get("input", record.get("params", {}).get("content", [])))
            )
            if title == "Untitled":
                title = prompt[:80]
            builder.prompt(prompt, timestamp)
            continue
        if record_type != "context.append_loop_event":
            continue
        event = record.get("event", record.get("params", {}).get("event", {}))
        event_type = event.get("type")
        if event_type == "content.part":
            part = event.get("part", {})
            if part.get("type") in {"think", "thinking"}:
                builder.thought(part.get("think", part.get("text", "")))
            elif part.get("type") in {"text", "output_text"}:
                builder.message(part.get("text", ""))
        elif event_type == "tool.call":
            builder.tool(
                event.get("toolCallId") or event.get("id") or event.get("call_id"),
                event.get("name"),
                event.get("args", event.get("arguments", {})),
            )
        elif event_type == "tool.result":
            builder.result(
                event.get("toolCallId") or event.get("tool_call_id") or event.get("call_id"),
                event.get("result", event.get("output", "")),
                event.get("is_error", False),
            )
        elif event_type == "step.end":
            builder.finish(
                "completed",
                timestamp,
                event.get("finishReason") or event.get("stop_reason") or "end_turn",
            )
    agent_state = state.get("agents", {}).get(selected, {})
    cwd = state.get("cwd", state.get("work_dir", agent_state.get("homedir", "")))
    return builder, identity, selected if len(wires) > 1 or branch else None, cwd, state.get("title") or title, records


def _blobify(turns):
    blobs = {}
    for turn in turns:
        for item in turn["items"]:
            if item["type"] != "tool" or "rawOutput" not in item:
                continue
            content = _json(item["rawOutput"]).encode("utf-8")
            if len(content) <= BLOB_THRESHOLD:
                continue
            digest = _sha(content)
            item["rawOutput"] = {
                "type": "blob_ref",
                "schemaVersion": 2,
                "sha256": digest,
                "mediaType": "application/json",
                "byteLength": len(content),
                "preview": content.decode("utf-8")[:200],
            }
            blobs[digest] = content
    return blobs


def convert_session(harness, source, branch=None, title=None, cwd=None):
    parsers = {
        "claude": _parse_claude,
        "pi": _parse_pi,
        "codex": _parse_codex,
        "kimi": _parse_kimi,
    }
    if harness not in parsers:
        raise ImportFailure("source_invalid", "Unsupported harness: %s" % harness)
    builder, identity, selected_branch, parsed_cwd, parsed_title, records = parsers[harness](
        Path(source), branch
    )
    turns = builder.done()
    identity_name = _json(
        {
            "branchIdentity": selected_branch,
            "sourceIdentity": identity,
            "sourceKind": harness,
        }
    )
    import_id = _stable_uuid(IMPORT_NAMESPACE, identity_name)
    entry_id = _stable_uuid(import_id, "entry")
    history_id = _stable_uuid(import_id, "history")
    for turn_index, turn in enumerate(turns):
        turn["turnId"] = _stable_uuid(import_id, "turn:%d" % turn_index)
        for item_index, item in enumerate(turn["items"]):
            item["itemId"] = _stable_uuid(
                import_id, "turn:%d:item:%d" % (turn_index, item_index)
            )
    blobs = _blobify(turns)
    timestamps = [
        _timestamp(record.get("timestamp") or record.get("time"))
        for record in records
        if record.get("timestamp") or record.get("time")
    ]
    created_at = timestamps[0] if timestamps else FALLBACK_TIMESTAMP
    updated_at = timestamps[-1] if timestamps else created_at
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
        source_session_id=str(identity),
    )


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


def import_session(harness, source, vault, entry_dir, branch=None, title=None, cwd=None):
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

    conversion = convert_session(harness, source, branch, title, cwd)
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
        "schemaVersion": 2,
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
