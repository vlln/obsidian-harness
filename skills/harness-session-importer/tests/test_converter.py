import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SKILL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL_ROOT / "scripts"))

import import_session  # noqa: E402
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
                result = importer.convert_session(harness, source, branch=branch)
                self.assertEqual(len(result.turns), turns)
                self.assertEqual(
                    sum(
                        item["type"] == "assistant_message"
                        for turn in result.turns
                        for item in turn["items"]
                    ),
                    messages,
                )
                self.assertGreaterEqual(
                    sum(
                        item["type"] == "tool" and "rawOutput" in item
                        for turn in result.turns
                        for item in turn["items"]
                    ),
                    1,
                )

    def test_branch_is_required_and_selected_without_mixing(self):
        for harness in ("claude", "pi"):
            source = FIXTURES / harness / "session.jsonl"
            with self.assertRaises(importer.ImportFailure) as failure:
                importer.convert_session(harness, source)
            self.assertEqual(failure.exception.code, "branch_required")

    def test_pi_selected_branch_keeps_sibling_tool_results(self):
        result = importer.convert_session(
            "pi", FIXTURES / "pi/session.jsonl", branch="p-main-leaf"
        )
        tools = [item for item in result.turns[0]["items"] if item["type"] == "tool"]
        self.assertEqual(len(tools), 2)
        self.assertTrue(all(item["status"] == "completed" for item in tools))

    def test_codex_deduplicates_message_keeps_tool_and_tail_prompt(self):
        result = importer.convert_session("codex", FIXTURES / "codex/session.jsonl")
        first, tail = result.turns
        self.assertEqual(
            [
                item["text"]
                for item in first["items"]
                if item["type"] == "assistant_message"
            ],
            ["Working on fixture."],
        )
        tool = next(item for item in first["items"] if item["type"] == "tool")
        self.assertEqual(tool["rawOutput"], {"content": "fixture output"})
        self.assertEqual(tail["status"], "interrupted")
        self.assertNotIn("endedAt", tail)

    def test_direct_import_writes_standard_continuable_session(self):
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory)
            (vault / ".obsidian").mkdir()
            result = importer.import_session(
                "codex",
                FIXTURES / "codex/session.jsonl",
                vault,
                "Projects/PJ_fixture",
            )

            entry = json.loads((vault / result["entryFile"]).read_text(encoding="utf-8"))
            self.assertEqual(entry["version"], 2)
            self.assertEqual(entry["entryId"], result["entryId"])
            self.assertEqual(entry["historyId"], result["historyId"])
            self.assertEqual(entry["agentId"], "codex-acp")
            self.assertEqual(
                entry["acpBinding"],
                {"agentId": "codex-acp", "sessionId": "codex-fixture"},
            )

            history = (
                vault
                / ".obsidian/plugins/obsidian-harness/sessions"
                / result["historyId"]
            )
            manifest = json.loads((history / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["metadata"]["agentId"], "codex-acp")
            turns = [
                json.loads(line)
                for line in (history / "turns.jsonl").read_text(encoding="utf-8").splitlines()
            ]
            self.assertEqual(manifest["schemaVersion"], 2)
            self.assertEqual(manifest["historyId"], result["historyId"])
            self.assertEqual(len(turns), 2)
            index = [
                json.loads(line)
                for line in (
                    vault
                    / ".obsidian/plugins/obsidian-harness/sessions/session_index.jsonl"
                ).read_text(encoding="utf-8").splitlines()
            ]
            self.assertEqual(index, [{
                "entryId": result["entryId"],
                "historyId": result["historyId"],
                "cwd": "/fixture/project",
                "entryFile": result["entryFile"],
            }])

    def test_large_outputs_are_lossless_and_deduplicated(self):
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory)
            (vault / ".obsidian").mkdir()
            source = vault / "source.jsonl"
            large = "x" * 70000
            records = [
                {"timestamp": "2026-01-01T00:00:00Z", "type": "session_meta", "payload": {"id": "large", "cwd": "/fixture"}},
                {"timestamp": "2026-01-01T00:00:01Z", "type": "response_item", "payload": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "large"}]}},
                {"timestamp": "2026-01-01T00:00:02Z", "type": "response_item", "payload": {"type": "function_call", "call_id": "c1", "name": "tool", "arguments": "{}"}},
                {"timestamp": "2026-01-01T00:00:03Z", "type": "response_item", "payload": {"type": "function_call_output", "call_id": "c1", "output": large}},
                {"timestamp": "2026-01-01T00:00:04Z", "type": "response_item", "payload": {"type": "function_call", "call_id": "c2", "name": "tool", "arguments": "{}"}},
                {"timestamp": "2026-01-01T00:00:05Z", "type": "response_item", "payload": {"type": "function_call_output", "call_id": "c2", "output": large}},
                {"timestamp": "2026-01-01T00:00:06Z", "type": "event_msg", "payload": {"type": "task_complete"}},
            ]
            source.write_text("\n".join(json.dumps(record) for record in records), encoding="utf-8")
            result = importer.import_session("codex", source, vault, ".")
            history = vault / ".obsidian/plugins/obsidian-harness/sessions" / result["historyId"]
            blobs = list((history / "blobs").iterdir())
            self.assertEqual(len(blobs), 1)
            self.assertIn(large, blobs[0].read_text(encoding="utf-8"))
            turn = json.loads((history / "turns.jsonl").read_text(encoding="utf-8"))
            refs = [item["rawOutput"]["sha256"] for item in turn["items"] if item["type"] == "tool"]
            self.assertEqual(refs, [refs[0], refs[0]])

    def test_repeat_is_noop_and_conflict_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory)
            (vault / ".obsidian").mkdir()
            source = FIXTURES / "codex/session.jsonl"
            first = importer.import_session("codex", source, vault, "Sessions")
            entry_path = vault / first["entryFile"]
            original = entry_path.read_bytes()
            second = importer.import_session("codex", source, vault, "Sessions")
            self.assertEqual(second["status"], "already_exists")
            self.assertEqual(entry_path.read_bytes(), original)

            entry_path.write_text("{}", encoding="utf-8")
            with self.assertRaises(importer.ImportFailure) as failure:
                importer.import_session("codex", source, vault, "Sessions")
            self.assertEqual(failure.exception.code, "target_conflict")
            self.assertEqual(entry_path.read_text(encoding="utf-8"), "{}")

    def test_vault_boundary_and_failure_publish_no_entry(self):
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory)
            (vault / ".obsidian").mkdir()
            source = FIXTURES / "codex/session.jsonl"
            with self.assertRaises(importer.ImportFailure) as boundary:
                importer.import_session("codex", source, vault, "../outside")
            self.assertEqual(boundary.exception.code, "vault_boundary_violation")

            with mock.patch("importer._write_sync", side_effect=OSError("injected")):
                with self.assertRaises(importer.ImportFailure) as failure:
                    importer.import_session("codex", source, vault, "Sessions")
            self.assertEqual(failure.exception.code, "write_failed")
            self.assertFalse(any(vault.rglob("*.session")))

    def test_malformed_source_and_cli_error_are_structured(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / ".obsidian").mkdir()
            source = Path(directory) / "bad.jsonl"
            source.write_text("{bad\n", encoding="utf-8")
            with self.assertRaises(importer.ImportFailure) as failure:
                importer.convert_session("codex", source)
            self.assertEqual(failure.exception.code, "source_invalid")

            original = sys.argv
            try:
                sys.argv = [
                    "import_session.py",
                    "--harness", "codex",
                    "--session", str(source),
                    "--vault", directory,
                    "--entry-dir", ".",
                ]
                error = io.StringIO()
                with mock.patch("sys.stderr", error):
                    self.assertEqual(import_session.main(), 2)
                self.assertEqual(json.loads(error.getvalue())["code"], "source_invalid")
            finally:
                sys.argv = original


if __name__ == "__main__":
    unittest.main()
