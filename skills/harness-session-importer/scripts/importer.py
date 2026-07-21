"""Private harness adapters and generic Obsidian Harness bundle writer."""

import hashlib
import json
import math
import os
import shutil
import tempfile
import uuid
from collections import Counter
from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime, timezone
from pathlib import Path

from runtime import BUNDLE_SCHEMA_VERSION, IMPORT_NAMESPACE

CONVERTER_VERSION = "0.1.0"
BLOB_THRESHOLD = 64 * 1024


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
class Inspection:
    turns: list
    report: dict
    blobs: dict


def _number(value):
    if not math.isfinite(value):
        raise ImportFailure("source_invalid", "JCS rejects non-finite numbers")
    if value == 0:
        return "0"
    text = repr(value).lower()
    decimal = Decimal(text)
    magnitude = abs(decimal)
    if Decimal("1e-6") <= magnitude < Decimal("1e21"):
        fixed = format(decimal, "f")
        return fixed.rstrip("0").rstrip(".") if "." in fixed else fixed
    mantissa, exponent = format(decimal.normalize(), "e").split("e")
    mantissa = mantissa.rstrip("0").rstrip(".")
    exponent_number = int(exponent)
    sign = "+" if exponent_number >= 0 else ""
    return "%se%s%s" % (mantissa, sign, exponent_number)


def canonical_json(value):
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, int):
        if abs(value) > 9007199254740991:
            raise ImportFailure("source_invalid", "JCS rejects unsafe integers")
        return str(value)
    if isinstance(value, float):
        return _number(value)
    if isinstance(value, str):
        try:
            value.encode("utf-8")
        except UnicodeEncodeError as error:
            raise ImportFailure("source_invalid", "JCS rejects unpaired Unicode surrogates") from error
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, list):
        return "[" + ",".join(canonical_json(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value, key=lambda item: item.encode("utf-16-be", "surrogatepass"))
        return "{" + ",".join(canonical_json(key) + ":" + canonical_json(value[key]) for key in keys) + "}"
    raise ImportFailure("source_invalid", "Unsupported JCS value: %s" % type(value).__name__)


def _sha(data):
    return hashlib.sha256(data).hexdigest()


def _stable_uuid(namespace, name):
    return str(uuid.uuid5(uuid.UUID(namespace), name))


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ImportFailure("source_invalid", "I-JSON rejects duplicate object key: %s" % key)
        result[key] = value
    return result


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
                    raise ImportFailure("source_invalid", "Invalid JSONL record", path, line_number) from error
    except FileNotFoundError as error:
        raise ImportFailure("source_not_found", "Source does not exist", path) from error
    if not records:
        raise ImportFailure("source_invalid", "Source contains no records", path)
    return records


def _timestamp(value):
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    return str(value or "")


def _text(content, accepted=("text", "input_text", "output_text")):
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    return "".join(str(part.get("text", "")) for part in content if isinstance(part, dict) and part.get("type") in accepted)


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
        self.diagnostics = []
        self._item = 0
        self._turn = 0

    def diagnostic(self, severity, code, source_type, message, impact):
        for diagnostic in self.diagnostics:
            if diagnostic["severity"] == severity and diagnostic["code"] == code and diagnostic["sourceType"] == source_type:
                diagnostic["count"] += 1
                return
        self.diagnostics.append({"severity": severity, "code": code, "sourceType": source_type, "count": 1, "message": message, "semanticImpact": impact})

    def prompt(self, text, timestamp):
        self.finish("interrupted")
        self._turn += 1
        self.current = {"schemaVersion": 2, "turnId": "turn-%04d" % self._turn, "status": "interrupted", "startedAt": _timestamp(timestamp), "prompt": [{"type": "text", "text": text}], "items": []}

    def _id(self):
        self._item += 1
        return "item-%04d" % self._item

    def message(self, text):
        if self.current is not None and text:
            self.current["items"].append({"type": "assistant_message", "itemId": self._id(), "text": text})

    def thought(self, text):
        if self.current is not None and text:
            self.current["items"].append({"type": "thought", "itemId": self._id(), "text": text})

    def tool(self, call_id, name, arguments):
        if self.current is None:
            return
        self.current["items"].append({"type": "tool", "itemId": self._id(), "toolCallId": str(call_id), "status": "in_progress", "kind": _kind(name), "title": str(name or "unknown"), "rawInput": arguments if isinstance(arguments, dict) else {"input": arguments}})

    def result(self, call_id, output, failed=False, source_type="tool_result"):
        if self.current is not None:
            for item in reversed(self.current["items"]):
                if item["type"] == "tool" and item["toolCallId"] == str(call_id):
                    item["status"] = "failed" if failed else "completed"
                    item["rawOutput"] = output if isinstance(output, dict) else {"content": output}
                    return
        self.diagnostic("degraded", "orphan_tool_result", source_type, "Tool result has no matching call", "Tool output ordering and ownership are unknown")

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
        for turn in self.turns:
            for item in turn["items"]:
                if item["type"] == "tool" and item["status"] == "in_progress":
                    self.diagnostic("degraded", "tool_state_unknown", "tool_call", "Tool call has no final result", "Tool completion state is unknown")
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
            if (leaf_types is None or record.get("type") in leaf_types) and (leaf_roles is None or role in leaf_roles):
                leaves.append(candidate)
                break
            candidate = record.get(parent_key)
    leaves = list(dict.fromkeys(leaves))
    choices = [{"id": leaf, "label": leaf} for leaf in leaves]
    if len(leaves) > 1 and branch is None:
        raise ImportFailure("branch_required", "Multiple branches require --branch", branches=choices)
    selected = branch or (leaves[0] if leaves else None)
    if selected not in nodes:
        raise ImportFailure("branch_not_found", "Selected branch does not exist", branches=choices)
    chain = []
    seen = set()
    while selected and selected in nodes and selected not in seen:
        seen.add(selected)
        record = nodes[selected]
        chain.append(record)
        selected = record.get(parent_key)
    chain.reverse()
    return chain, choices


def _parse_claude(path, branch):
    records = _read_jsonl(path)
    identity = next((item.get("sessionId") for item in records if item.get("sessionId")), None)
    if not identity:
        raise ImportFailure("source_identity_missing", "Claude session identity is missing", path)
    chain, branches = _select_chain(records, "uuid", "parentUuid", branch, {"user", "assistant"})
    builder = Builder()
    cwd = next((item.get("cwd") for item in records if item.get("cwd")), "")
    title = "Untitled"
    created = next((item.get("timestamp") for item in chain if item.get("timestamp")), "")
    for record in chain:
        kind = record.get("type")
        message = record.get("message", {})
        content = message.get("content", "")
        timestamp = record.get("timestamp", "")
        if kind == "user" and isinstance(content, str):
            title = title if title != "Untitled" else content[:80]
            builder.prompt(content, timestamp)
        elif kind == "user" and isinstance(content, list):
            for part in content:
                if part.get("type") == "tool_result":
                    builder.result(part.get("tool_use_id"), part.get("content", ""), part.get("is_error", False), "tool_result")
        elif kind == "assistant":
            for part in content if isinstance(content, list) else []:
                part_type = part.get("type")
                if part_type == "thinking":
                    builder.thought(part.get("thinking", ""))
                elif part_type == "text":
                    builder.message(part.get("text", ""))
                elif part_type == "tool_use":
                    builder.tool(part.get("id"), part.get("name"), part.get("input", {}))
                else:
                    builder.diagnostic("degraded", "unknown_content", str(part_type), "Unknown Claude content block", "Visible content may be missing")
            stop = message.get("stop_reason") or message.get("stopReason")
            if stop in {"end_turn", "stop", "max_tokens"}:
                builder.finish("completed", timestamp, stop)
        elif kind not in {"queue-operation", "progress", "system"}:
            builder.diagnostic("degraded", "unknown_record", str(kind), "Unknown Claude record", "Visible content may be missing")
    return builder, identity, branch, branches, cwd, title, created, records


def _parse_pi(path, branch):
    records = _read_jsonl(path)
    header = next((item for item in records if item.get("type") == "session"), None)
    identity = header.get("id") if header else None
    if not identity:
        raise ImportFailure("source_identity_missing", "Pi session identity is missing", path)
    messages = [item for item in records if item.get("type") == "message"]
    chain, branches = _select_chain(messages, "id", "parentId", branch, leaf_roles={"user", "assistant"})
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
            title = title if title != "Untitled" else prompt[:80]
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
                else:
                    builder.diagnostic("degraded", "unknown_content", str(part_type), "Unknown Pi content block", "Visible content may be missing")
            stop = message.get("stopReason")
            if stop in {"stop", "end_turn", "maxTokens"}:
                builder.finish("completed", timestamp, stop)
        elif role == "toolResult":
            builder.result(message.get("toolCallId"), _text(content), message.get("isError", False), "toolResult")
        else:
            builder.diagnostic("degraded", "unknown_record", str(role), "Unknown Pi message role", "Visible content may be missing")
    return builder, identity, branch, branches, header.get("cwd", ""), title, header.get("timestamp", ""), records


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
    meta = next((item.get("payload", {}) for item in records if item.get("type") == "session_meta"), {})
    identity = meta.get("id") or meta.get("session_id")
    if not identity:
        raise ImportFailure("source_identity_missing", "Codex session identity is missing", path)
    builder = Builder()
    title = "Untitled"
    response_messages = Counter()
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
                title = title if title != "Untitled" else text[:80]
                builder.prompt(text, timestamp)
            elif role == "assistant":
                response_messages[text] += 1
                if text in pending_event_messages:
                    pending_event_messages.remove(text)
                else:
                    builder.message(text)
        elif record_type == "event_msg" and payload_type == "agent_message":
            text = payload.get("message", "")
            if response_messages[text]:
                response_messages[text] -= 1
            else:
                builder.message(text)
                pending_event_messages.append(text)
        elif record_type == "response_item" and payload_type in {"function_call", "custom_tool_call"}:
            raw = payload.get("arguments", payload.get("input", {}))
            builder.tool(payload.get("call_id") or payload.get("id"), payload.get("name"), _arguments(raw))
        elif record_type == "response_item" and payload_type in {"function_call_output", "custom_tool_call_output"}:
            builder.result(payload.get("call_id"), payload.get("output", payload.get("result", "")), payload.get("is_error", False), payload_type)
        elif record_type in {"function_call", "custom_tool_call"}:
            builder.tool(payload.get("call_id") or payload.get("id"), payload.get("name"), _arguments(payload.get("arguments", payload.get("input", {}))))
        elif record_type in {"function_call_output", "custom_tool_call_output"}:
            builder.result(payload.get("call_id"), payload.get("output", payload.get("result", "")), payload.get("is_error", False), record_type)
        elif (record_type == "event_msg" and payload_type in {"task_complete", "turn_complete"}) or record_type == "task_complete":
            builder.finish("completed", timestamp, payload.get("stop_reason") or "end_turn")
        elif record_type == "response_item" and payload_type == "reasoning":
            builder.diagnostic("info", "encrypted_reasoning_ignored", "reasoning", "Encrypted reasoning is not importable", "No visible semantic content is lost")
        elif record_type in {"session_meta", "turn_context", "task_started"} or (record_type == "event_msg" and payload_type in {"user_message", "token_count", "task_started"}):
            continue
        else:
            builder.diagnostic("degraded", "unknown_record", "%s:%s" % (record_type, payload_type), "Unknown Codex record", "Visible content may be missing")
    return builder, identity, None, [], meta.get("cwd", ""), title, records[0].get("timestamp", ""), records


def _parse_kimi(path, branch):
    directory = Path(path)
    state_path = directory / "state.json"
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"), object_pairs_hook=_object)
    except FileNotFoundError as error:
        raise ImportFailure("source_not_found", "Kimi state.json is missing", state_path) from error
    directory_identity = directory.name[8:] if directory.name.startswith("session_") else None
    identity = state.get("session_id") or state.get("id") or directory_identity
    if not identity:
        raise ImportFailure("source_identity_missing", "Kimi session identity is missing", state_path)
    root_wire = directory / "wire.jsonl"
    if root_wire.exists():
        wires = {"main": root_wire}
    else:
        wires = {item.parent.name: item for item in sorted((directory / "agents").glob("*/wire.jsonl"))}
    choices = [{"id": name, "label": name} for name in wires]
    if len(wires) > 1 and branch is None:
        raise ImportFailure("branch_required", "Multiple Kimi agents require --branch", branches=choices)
    selected = branch or (next(iter(wires)) if wires else None)
    if selected not in wires:
        raise ImportFailure("branch_not_found", "Selected Kimi agent does not exist", branches=choices)
    wire_path = wires[selected]
    records = _read_jsonl(wire_path)
    builder = Builder()
    title = "Untitled"
    for record in records:
        record_type = record.get("type") or record.get("method")
        timestamp = record.get("time") or record.get("timestamp", "")
        if record_type == "turn.prompt":
            prompt = _text(record.get("content", record.get("input", record.get("params", {}).get("content", []))))
            title = title if title != "Untitled" else prompt[:80]
            builder.prompt(prompt, timestamp)
            continue
        if record_type != "context.append_loop_event":
            if record_type in {"context.append_message", "permission.set_mode"}:
                builder.diagnostic("info", "control_or_duplicate_ignored", str(record_type), "Kimi control or duplicate context record is represented by semantic turn events", "No visible semantic content is lost")
            elif record_type not in {"metadata", "tools.set_active_tools", "config.update", "usage.record"}:
                builder.diagnostic("degraded", "unknown_record", str(record_type), "Unknown Kimi record", "Visible content may be missing")
            continue
        event = record.get("event", record.get("params", {}).get("event", {}))
        event_type = event.get("type")
        if event_type == "content.part":
            part = event.get("part", {})
            if part.get("type") in {"think", "thinking"}:
                builder.thought(part.get("think", part.get("text", "")))
            elif part.get("type") in {"text", "output_text"}:
                builder.message(part.get("text", ""))
            else:
                builder.diagnostic("degraded", "unknown_content", str(part.get("type")), "Unknown Kimi content part", "Visible content may be missing")
        elif event_type == "tool.call":
            builder.tool(event.get("toolCallId") or event.get("id") or event.get("call_id"), event.get("name"), event.get("args", event.get("arguments", {})))
        elif event_type == "tool.result":
            builder.result(event.get("toolCallId") or event.get("tool_call_id") or event.get("call_id"), event.get("result", event.get("output", "")), event.get("is_error", False), event_type)
        elif event_type == "step.end":
            builder.finish("completed", timestamp, event.get("finishReason") or event.get("stop_reason") or "end_turn")
        elif event_type not in {"step.begin"}:
            builder.diagnostic("degraded", "unknown_record", str(event_type), "Unknown Kimi loop event", "Visible content may be missing")
    files = [(state_path, "state"), (wire_path, "main-wire")]
    agent_state = state.get("agents", {}).get(selected, {})
    return builder, identity, selected if len(wires) > 1 or branch else None, choices if len(wires) > 1 else [], state.get("cwd", state.get("work_dir", agent_state.get("homedir", ""))), state.get("title") or title, _timestamp(state.get("created_at", state.get("createdAt", records[0].get("time", "")))), records, files


def _source_files(harness, source, parsed):
    if harness == "kimi":
        files = parsed[-1]
    else:
        files = [(Path(source), "session")]
    result = []
    for path, role in files:
        content = Path(path).read_bytes()
        result.append({"role": role, "byteLength": len(content), "sha256": _sha(content)})
    return sorted(result, key=lambda item: item["role"])


def _blobify(turns):
    blobs = {}
    for turn in turns:
        for item in turn["items"]:
            if item["type"] != "tool" or "rawOutput" not in item:
                continue
            content = canonical_json(item["rawOutput"]).encode("utf-8")
            if len(content) <= BLOB_THRESHOLD:
                continue
            digest = _sha(content)
            preview = content[:512].decode("utf-8", "replace")
            item["rawOutput"] = {"type": "blob_ref", "schemaVersion": 2, "sha256": digest, "mediaType": "application/json", "byteLength": len(content), "preview": preview}
            blobs[digest] = content
    return blobs


def inspect_session(harness, source, branch=None, title=None, cwd=None):
    source = Path(source)
    parsers = {"claude": _parse_claude, "pi": _parse_pi, "codex": _parse_codex, "kimi": _parse_kimi}
    if harness not in parsers:
        raise ImportFailure("source_invalid", "Unsupported harness: %s" % harness)
    parsed = parsers[harness](source, branch)
    builder, identity, selected_branch, branches, parsed_cwd, parsed_title, created, records = parsed[:8]
    turns = builder.done()
    identity_input = {"schemaVersion": 1, "sourceKind": harness, "sourceIdentity": identity, "branchIdentity": selected_branch}
    import_id = _stable_uuid(IMPORT_NAMESPACE, canonical_json(identity_input))
    entry_id = _stable_uuid(import_id, "entry")
    history_id = _stable_uuid(import_id, "history")
    for turn_index, turn in enumerate(turns):
        turn["turnId"] = _stable_uuid(import_id, "turn:%d" % turn_index)
        for item_index, item in enumerate(turn["items"]):
            item["itemId"] = _stable_uuid(import_id, "turn:%d:item:%d" % (turn_index, item_index))
    blobs = _blobify(turns)
    source_files = _source_files(harness, source, parsed)
    output = {
        "turns": len(turns),
        "prompts": sum(len(turn["prompt"]) for turn in turns),
        "assistantMessages": sum(item["type"] == "assistant_message" for turn in turns for item in turn["items"]),
        "thoughts": sum(item["type"] == "thought" for turn in turns for item in turn["items"]),
        "toolCalls": sum(item["type"] == "tool" for turn in turns for item in turn["items"]),
        "toolResults": sum(item["type"] == "tool" and "rawOutput" in item for turn in turns for item in turn["items"]),
        "blobs": len(blobs),
    }
    complete = not any(item["severity"] in {"degraded", "ambiguous"} for item in builder.diagnostics)
    report = {
        "schemaVersion": 1,
        "converterVersion": CONVERTER_VERSION,
        "source": {"kind": harness, "identity": identity, "branchIdentity": selected_branch, "digest": _sha(canonical_json(source_files).encode("utf-8")), "files": source_files},
        "metadata": {"title": title or parsed_title or "Untitled", "cwd": cwd if cwd is not None else parsed_cwd, "createdAt": created},
        "input": {"records": len(records), "recordTypes": dict(Counter(str(item.get("type", "unknown")) for item in records))},
        "output": output,
        "diagnostics": builder.diagnostics,
        "complete": complete,
        "branches": [{"id": item["id"], "label": item["label"], "selected": item["id"] == selected_branch} for item in branches],
        "candidate": {"importId": import_id, "entryId": entry_id, "historyId": history_id, "entryFile": None},
        "result": {"status": "inspected", "descriptor": None},
    }
    return Inspection(turns, report, blobs)


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


def _fsync_dir(path):
    descriptor = os.open(str(path), os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def create_bundle(harness, source, vault, entry_dir, branch=None, title=None, cwd=None, accept_incomplete=False):
    vault = Path(vault)
    if not vault.is_absolute() or not (vault / ".obsidian").is_dir():
        raise ImportFailure("vault_invalid", "--vault must be an absolute Obsidian vault", vault)
    entry_path = Path(entry_dir)
    if entry_path.is_absolute() or ".." in entry_path.parts:
        raise ImportFailure("vault_boundary_violation", "entry-dir must stay inside the vault", entry_dir)
    root = vault.resolve()
    target = (root / entry_path).resolve()
    if not _inside(root, target):
        raise ImportFailure("vault_boundary_violation", "entry-dir escapes the vault", target)
    inspection = inspect_session(harness, source, branch, title, cwd)
    if not inspection.report["complete"] and not accept_incomplete:
        raise ImportFailure("incomplete_not_accepted", "Conversion is incomplete; inspect diagnostics first")
    import_id = inspection.report["candidate"]["importId"]
    descriptor_name = "session-import-%s.harness-import" % import_id
    descriptor = target / descriptor_name
    bundle = Path(str(descriptor) + ".bundle")
    entry_file = str((entry_path / ("session-%s.session" % inspection.report["candidate"]["entryId"])).as_posix())
    report = json.loads(json.dumps(inspection.report))
    report["candidate"]["entryFile"] = entry_file
    report["result"] = {"status": "bundle_created", "descriptor": str(descriptor.relative_to(root).as_posix())}
    blob_metadata = []
    for turn in inspection.turns:
        for item in turn["items"]:
            output = item.get("rawOutput")
            if isinstance(output, dict) and output.get("type") == "blob_ref":
                metadata = {key: output[key] for key in ("sha256", "mediaType", "byteLength", "preview")}
                if metadata not in blob_metadata:
                    blob_metadata.append(metadata)
    blob_metadata.sort(key=lambda item: item["sha256"])
    conversion_input = {"turns": inspection.turns, "blobs": blob_metadata, "report": {key: report[key] for key in ("output", "diagnostics", "complete", "branches")}}
    conversion_digest = _sha(canonical_json(conversion_input).encode("utf-8"))
    manifest = {
        "schemaVersion": BUNDLE_SCHEMA_VERSION,
        "importId": import_id,
        "sourceKind": harness,
        "sourceIdentity": report["source"]["identity"],
        "branchIdentity": report["source"]["branchIdentity"],
        "sourceDigest": report["source"]["digest"],
        "conversionDigest": conversion_digest,
        "converterVersion": CONVERTER_VERSION,
        "createdAt": report["metadata"]["createdAt"],
        "target": {"entryDir": str(entry_path.as_posix()), "title": report["metadata"]["title"], "cwd": report["metadata"]["cwd"]},
        "transcript": {"schemaVersion": 2, "turnsPath": "turns.jsonl", "blobsPath": "blobs"},
        "reportPath": "report.json",
    }
    manifest_bytes = (canonical_json(manifest) + "\n").encode("utf-8")
    descriptor_data = {"schemaVersion": 1, "bundlePath": str(bundle.relative_to(root).as_posix()), "manifestSha256": _sha(manifest_bytes)}
    if descriptor.exists() or bundle.exists():
        try:
            existing_descriptor = json.loads(descriptor.read_text(encoding="utf-8"))
            existing_manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ImportFailure("bundle_write_failed", "Existing import candidate is invalid", descriptor) from error
        if existing_descriptor == descriptor_data and existing_manifest == manifest:
            status = "already_exists"
            report["result"]["status"] = "bundle_already_exists"
            return _bundle_result(status, descriptor, bundle, root, report, conversion_digest)
        raise ImportFailure("bundle_write_failed", "Import candidate path already exists with different content", descriptor)
    target.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".%s." % descriptor_name, dir=str(target)))
    descriptor_temp = target / (".%s.%s.tmp" % (descriptor_name, uuid.uuid4()))
    try:
        (staging / "blobs").mkdir()
        turns_bytes = b"".join((canonical_json(turn) + "\n").encode("utf-8") for turn in inspection.turns)
        _write_sync(staging / "turns.jsonl", turns_bytes)
        _write_sync(staging / "report.json", (canonical_json(report) + "\n").encode("utf-8"))
        _write_sync(staging / "manifest.json", manifest_bytes)
        for digest, content in inspection.blobs.items():
            _write_sync(staging / "blobs" / ("sha256-%s" % digest), content)
        _fsync_dir(staging / "blobs")
        _fsync_dir(staging)
        os.replace(str(staging), str(bundle))
        _fsync_dir(target)
        _write_sync(descriptor_temp, (canonical_json(descriptor_data) + "\n").encode("utf-8"))
        os.replace(str(descriptor_temp), str(descriptor))
        _fsync_dir(target)
    except OSError as error:
        if staging.exists():
            shutil.rmtree(staging)
        if descriptor_temp.exists():
            descriptor_temp.unlink()
        if bundle.exists() and not descriptor.exists():
            shutil.rmtree(bundle)
        raise ImportFailure("bundle_write_failed", "Failed to publish import bundle", descriptor) from error
    return _bundle_result("created", descriptor, bundle, root, report, conversion_digest)


def _bundle_result(status, descriptor, bundle, root, report, conversion_digest):
    relative_descriptor = str(descriptor.relative_to(root).as_posix())
    return {
        "schemaVersion": 1,
        "status": status,
        "descriptor": relative_descriptor,
        "bundleDirectory": str(bundle.relative_to(root).as_posix()),
        "importId": report["candidate"]["importId"],
        "sourceDigest": report["source"]["digest"],
        "conversionDigest": conversion_digest,
        "report": report,
        "wikilink": "[[%s]]" % relative_descriptor,
    }
