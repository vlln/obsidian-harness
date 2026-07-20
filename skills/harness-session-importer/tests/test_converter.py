import json
import sys
import tempfile
import unittest
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL_ROOT / "scripts"))

import importer  # noqa: E402


FIXTURES = SKILL_ROOT / "tests" / "fixtures"


class ConverterTest(unittest.TestCase):
    def test_four_adapters_preserve_semantic_counts(self):
        cases = [
            ("claude", FIXTURES / "claude/session.jsonl", "c-main-leaf", 1, 2),
            ("pi", FIXTURES / "pi/session.jsonl", "p-main-leaf", 1, 1),
            ("codex", FIXTURES / "codex/session.jsonl", None, 2, 1),
            ("kimi", FIXTURES / "kimi", None, 1, 1),
        ]
        for harness, source, branch, turns, messages in cases:
            with self.subTest(harness=harness):
                result = importer.inspect_session(harness, source, branch=branch)
                self.assertEqual(len(result.turns), turns)
                self.assertEqual(result.report["output"]["assistantMessages"], messages)
                self.assertGreaterEqual(result.report["output"]["toolResults"], 1)

    def test_branch_is_required_and_selected_without_mixing(self):
        for harness in ("claude", "pi"):
            source = FIXTURES / harness / "session.jsonl"
            with self.assertRaisesRegex(importer.ImportFailure, "branch"):
                importer.inspect_session(harness, source)

    def test_codex_deduplicates_message_keeps_nested_tool_and_tail_prompt(self):
        result = importer.inspect_session("codex", FIXTURES / "codex/session.jsonl")
        first, tail = result.turns
        self.assertEqual(
            [item["text"] for item in first["items"] if item["type"] == "assistant_message"],
            ["Working on fixture."],
        )
        tool = next(item for item in first["items"] if item["type"] == "tool")
        self.assertEqual(tool["rawOutput"], {"content": "fixture output"})
        self.assertEqual(tail["status"], "interrupted")
        self.assertNotIn("endedAt", tail)

    def test_unknown_and_orphan_tool_result_are_explicit_degradations(self):
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl") as source:
            records = [
                {"timestamp": "2026-01-01T00:00:00Z", "type": "session_meta", "payload": {"id": "x", "cwd": "/fixture"}},
                {"timestamp": "2026-01-01T00:00:01Z", "type": "response_item", "payload": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "x"}]}},
                {"timestamp": "2026-01-01T00:00:02Z", "type": "response_item", "payload": {"type": "custom_tool_call_output", "call_id": "missing", "output": "x"}},
                {"timestamp": "2026-01-01T00:00:03Z", "type": "mystery", "payload": {}},
            ]
            source.write("\n".join(json.dumps(record) for record in records))
            source.flush()
            result = importer.inspect_session("codex", Path(source.name))
        self.assertFalse(result.report["complete"])
        self.assertEqual({item["code"] for item in result.report["diagnostics"]}, {"orphan_tool_result", "unknown_record"})

    def test_bundle_is_lossless_idempotent_and_stays_inside_vault(self):
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory)
            (vault / ".obsidian").mkdir()
            source = vault / "source.jsonl"
            large = "x" * 70000
            records = [
                {"timestamp": "2026-01-01T00:00:00Z", "type": "session_meta", "payload": {"id": "large", "cwd": "/fixture"}},
                {"timestamp": "2026-01-01T00:00:01Z", "type": "response_item", "payload": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "large"}]}},
                {"timestamp": "2026-01-01T00:00:02Z", "type": "response_item", "payload": {"type": "function_call", "call_id": "c", "name": "tool", "arguments": "{}"}},
                {"timestamp": "2026-01-01T00:00:03Z", "type": "response_item", "payload": {"type": "function_call_output", "call_id": "c", "output": large}},
                {"timestamp": "2026-01-01T00:00:04Z", "type": "event_msg", "payload": {"type": "task_complete"}},
            ]
            source.write_text("\n".join(json.dumps(record) for record in records), encoding="utf-8")
            first = importer.create_bundle("codex", source, vault, "Imports")
            second = importer.create_bundle("codex", source, vault, "Imports")
            self.assertEqual(first["status"], "created")
            self.assertEqual(second["status"], "already_exists")
            bundle = vault / first["bundleDirectory"]
            blobs = list((bundle / "blobs").iterdir())
            self.assertEqual(len(blobs), 1)
            self.assertIn(large, blobs[0].read_text(encoding="utf-8"))
            self.assertFalse((vault / ".obsidian/plugins/obsidian-harness/sessions").exists())
            with self.assertRaisesRegex(importer.ImportFailure, "entry-dir"):
                importer.create_bundle("codex", source, vault, "../outside")

    def test_malformed_json_and_missing_identity_fail_without_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "bad.jsonl"
            source.write_text("{bad\n", encoding="utf-8")
            with self.assertRaises(importer.ImportFailure) as failure:
                importer.inspect_session("codex", source)
            self.assertEqual(failure.exception.code, "source_invalid")


if __name__ == "__main__":
    unittest.main()
