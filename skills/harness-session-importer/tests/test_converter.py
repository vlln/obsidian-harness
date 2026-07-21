import json
import io
import hashlib
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL_ROOT / "scripts"))

import importer  # noqa: E402
import import_session  # noqa: E402


FIXTURES = SKILL_ROOT / "tests" / "fixtures"


class ConverterTest(unittest.TestCase):
    def test_canonical_json_number_and_key_rules(self):
        self.assertEqual(importer.canonical_json({"z": 1e20, "a": 1e-7}), '{"a":1e-7,"z":100000000000000000000}')
        self.assertEqual(importer.canonical_json(-0.0), "0")
        with self.assertRaises(importer.ImportFailure):
            importer.canonical_json(float("inf"))
        with self.assertRaises(importer.ImportFailure):
            importer.canonical_json(9007199254740992)
        with self.assertRaises(importer.ImportFailure):
            importer.canonical_json("\ud800")

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

    def test_pi_selected_branch_keeps_sibling_tool_results(self):
        result = importer.inspect_session(
            "pi", FIXTURES / "pi/session.jsonl", branch="p-main-leaf"
        )
        tools = [item for item in result.turns[0]["items"] if item["type"] == "tool"]
        self.assertEqual(len(tools), 2)
        self.assertTrue(all(item["status"] == "completed" for item in tools))
        self.assertEqual(result.report["output"]["toolResults"], 2)

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

    def test_incomplete_bundle_requires_explicit_acceptance(self):
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory)
            (vault / ".obsidian").mkdir()
            source = vault / "session.jsonl"
            source.write_text(
                "\n".join(
                    json.dumps(record)
                    for record in [
                        {"timestamp": "2026-01-01T00:00:00Z", "type": "session_meta", "payload": {"id": "incomplete", "cwd": "/fixture"}},
                        {"timestamp": "2026-01-01T00:00:01Z", "type": "response_item", "payload": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "x"}]}},
                        {"timestamp": "2026-01-01T00:00:02Z", "type": "mystery", "payload": {}},
                    ]
                ),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(importer.ImportFailure, "incomplete"):
                importer.create_bundle("codex", source, vault, ".")
            result = importer.create_bundle("codex", source, vault, ".", accept_incomplete=True)
            self.assertEqual(result["status"], "created")


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
                {"timestamp": "2026-01-01T00:00:04Z", "type": "response_item", "payload": {"type": "function_call", "call_id": "c2", "name": "tool", "arguments": "{}"}},
                {"timestamp": "2026-01-01T00:00:05Z", "type": "response_item", "payload": {"type": "function_call_output", "call_id": "c2", "output": large}},
                {"timestamp": "2026-01-01T00:00:06Z", "type": "event_msg", "payload": {"type": "task_complete"}},
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
            turns = [json.loads(line) for line in (bundle / "turns.jsonl").read_text(encoding="utf-8").splitlines()]
            references = [item["rawOutput"]["sha256"] for item in turns[0]["items"] if item["type"] == "tool"]
            self.assertEqual(references, [references[0], references[0]])
            descriptor = json.loads((vault / first["descriptor"]).read_text(encoding="utf-8"))
            manifest_bytes = (bundle / "manifest.json").read_bytes()
            self.assertEqual(descriptor["manifestSha256"], hashlib.sha256(manifest_bytes).hexdigest())
            self.assertFalse((vault / ".obsidian/plugins/obsidian-harness/sessions").exists())
            with self.assertRaisesRegex(importer.ImportFailure, "entry-dir"):
                importer.create_bundle("codex", source, vault, "../outside")
            outside = vault.parent / (vault.name + "-outside")
            outside.mkdir()
            (vault / "escape").symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(importer.ImportFailure, "escapes"):
                importer.create_bundle("codex", source, vault, "escape")
            outside.rmdir()

    def test_bundle_publish_failure_leaves_no_recognizable_candidate(self):
        failure_points = ("importer._write_sync", "importer._fsync_dir", "importer.os.replace")
        for failure_point in failure_points:
            with self.subTest(failure_point=failure_point), tempfile.TemporaryDirectory() as directory:
                vault = Path(directory)
                (vault / ".obsidian").mkdir()
                source = FIXTURES / "codex/session.jsonl"
                with mock.patch(failure_point, side_effect=OSError("injected")):
                    with self.assertRaises(importer.ImportFailure) as failure:
                        importer.create_bundle("codex", source, vault, "Imports")
                self.assertEqual(failure.exception.code, "bundle_write_failed")
                imports = vault / "Imports"
                self.assertFalse(any(imports.glob("*.harness-import")))
                self.assertFalse(any(imports.glob("*.harness-import.bundle")))

    def test_malformed_json_and_missing_identity_fail_without_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "bad.jsonl"
            source.write_text("{bad\n", encoding="utf-8")
            with self.assertRaises(importer.ImportFailure) as failure:
                importer.inspect_session("codex", source)
            self.assertEqual(failure.exception.code, "source_invalid")

            source.write_text('{"x":1,"x":2}\n', encoding="utf-8")
            with self.assertRaises(importer.ImportFailure) as duplicate:
                importer.inspect_session("codex", source)
            self.assertEqual(duplicate.exception.code, "source_invalid")

            source.write_text(
                json.dumps(
                    {
                        "timestamp": "2026-01-01T00:00:00Z",
                        "type": "session_meta",
                        "payload": {"cwd": "/fixture"},
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            with self.assertRaises(importer.ImportFailure) as missing_identity:
                importer.inspect_session("codex", source)
            self.assertEqual(missing_identity.exception.code, "source_identity_missing")

    def test_cli_inspect_and_structured_error(self):
        original = sys.argv
        try:
            sys.argv = [
                "import_session.py",
                "inspect",
                "--harness",
                "codex",
                "--session",
                str(FIXTURES / "codex/session.jsonl"),
            ]
            output = io.StringIO()
            with mock.patch("sys.stdout", output):
                self.assertEqual(import_session.main(), 0)
            self.assertEqual(json.loads(output.getvalue())["source"]["identity"], "codex-fixture")

            sys.argv = [
                "import_session.py",
                "inspect",
                "--harness",
                "codex",
                "--session",
                str(FIXTURES / "missing.jsonl"),
            ]
            error = io.StringIO()
            with mock.patch("sys.stderr", error):
                self.assertEqual(import_session.main(), 2)
            self.assertEqual(json.loads(error.getvalue())["code"], "source_not_found")
        finally:
            sys.argv = original


if __name__ == "__main__":
    unittest.main()
