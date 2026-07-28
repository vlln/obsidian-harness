"""Tests for the AHS → Obsidian Harness session importer.

Tests use AHS fixtures (not native-format fixtures) and mock the
``ahs-export`` subprocess, so they are fast and self-contained — no
harness-adapter repo or Node.js required.
"""

import io
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SKILL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL_ROOT / "scripts"))

import import_session  # noqa: E402
import importer  # noqa: E402

FIXTURES = SKILL_ROOT / "tests" / "fixtures" / "ahs"


def _mock_ahs_export(fixture_dir):
    """Return a mock for _run_ahs_export that copies a fixture AHS archive.

    The real _run_ahs_export calls ``npx vite-node ahs-export.ts`` and writes
    to a temp dir. The mock copies the fixture directory tree to the out_dir
    and returns the session subdirectory path, matching the real contract.
    """
    def _copy(adapter_path, harness, session_id, out_dir):
        dest = Path(out_dir) / session_id
        shutil.copytree(fixture_dir, dest)
        return dest
    return _copy


class SessionIdExtractionTest(unittest.TestCase):
    """sessionId extraction from source paths (harness-specific)."""

    def test_claude_code_uuid_stem(self):
        path = Path("~/.claude/projects/proj/1b3e5971-e605-4d79-9d78-514ae2305174.jsonl")
        self.assertEqual(
            importer._extract_session_id("claude-code", path),
            "1b3e5971-e605-4d79-9d78-514ae2305174",
        )

    def test_claude_alias_resolves(self):
        path = Path("~/.claude/projects/proj/1b3e5971-e605-4d79-9d78-514ae2305174.jsonl")
        self.assertEqual(
            importer._extract_session_id("claude", path),
            "1b3e5971-e605-4d79-9d78-514ae2305174",
        )

    def test_codex_uuid_in_rollout_filename(self):
        path = Path("~/.codex/sessions/2026/03/20/rollout-2026-03-20T19-49-36-019d0b14-5bfe-7cd3-9c51-44fda369ae1e.jsonl")
        self.assertEqual(
            importer._extract_session_id("codex", path),
            "019d0b14-5bfe-7cd3-9c51-44fda369ae1e",
        )

    def test_pi_ulid_after_underscore(self):
        path = Path("~/.pi/agent/sessions/proj/2026-07-06T07-17-36-816Z_019f364a-25b0-7f3c-9ea2-adf450e7f7f6.jsonl")
        self.assertEqual(
            importer._extract_session_id("pi", path),
            "019f364a-25b0-7f3c-9ea2-adf450e7f7f6",
        )

    def test_kimi_code_dir_without_prefix(self):
        path = Path("~/.kimi-code/sessions/wd_123/session_faf60237-95f3-4de3-ad9a-f1647dc9e0de")
        self.assertEqual(
            importer._extract_session_id("kimi-code", path),
            "faf60237-95f3-4de3-ad9a-f1647dc9e0de",
        )

    def test_kimi_alias_resolves(self):
        path = Path("~/.kimi-code/sessions/wd_123/session_faf60237-95f3-4de3-ad9a-f1647dc9e0de")
        self.assertEqual(
            importer._extract_session_id("kimi", path),
            "faf60237-95f3-4de3-ad9a-f1647dc9e0de",
        )


class ProjectionTest(unittest.TestCase):
    """AHS records → Obsidian transcript turns projection."""

    def test_simple_projection_preserves_semantic_counts(self):
        archive = importer._read_ahs_archive(FIXTURES / "simple")
        turns, blobs = importer._project_ahs_to_turns(archive, FIXTURES / "simple")
        self.assertEqual(len(turns), 2)
        # Turn 0: completed (has end boundary), 1 assistant_message + 1 tool
        self.assertEqual(turns[0]["status"], "completed")
        self.assertEqual(turns[0]["endedAt"], "2026-01-01T00:00:05Z")
        types = [item["type"] for item in turns[0]["items"]]
        self.assertIn("assistant_message", types)
        self.assertIn("tool", types)
        # Turn 1: interrupted (no end boundary)
        self.assertEqual(turns[1]["status"], "interrupted")
        self.assertNotIn("endedAt", turns[1])

    def test_tool_call_paired_with_result(self):
        archive = importer._read_ahs_archive(FIXTURES / "simple")
        turns, _ = importer._project_ahs_to_turns(archive, FIXTURES / "simple")
        tools = [item for item in turns[0]["items"] if item["type"] == "tool"]
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["toolCallId"], "c1")
        self.assertEqual(tools[0]["rawOutput"], {"content": "fixture output"})
        self.assertEqual(tools[0]["status"], "completed")

    def test_thinking_blocks_become_thought_items(self):
        archive = importer._read_ahs_archive(FIXTURES / "multi-branch", branch="main")
        turns, _ = importer._project_ahs_to_turns(archive, FIXTURES / "multi-branch")
        thoughts = [item for item in turns[0]["items"] if item["type"] == "thought"]
        self.assertEqual(len(thoughts), 1)
        self.assertEqual(thoughts[0]["text"], "Planning")

    def test_usage_carried_to_turn(self):
        archive = importer._read_ahs_archive(FIXTURES / "simple")
        turns, _ = importer._project_ahs_to_turns(archive, FIXTURES / "simple")
        self.assertIn("usage", turns[0])
        self.assertEqual(turns[0]["usage"]["used"], 100)

    def test_prompt_extracted_from_user_message(self):
        archive = importer._read_ahs_archive(FIXTURES / "simple")
        turns, _ = importer._project_ahs_to_turns(archive, FIXTURES / "simple")
        self.assertEqual(turns[0]["prompt"][0]["text"], "Working on fixture.")
        self.assertEqual(turns[1]["prompt"][0]["text"], "Continue.")


class BranchTest(unittest.TestCase):
    """Multi-branch AHS archive handling."""

    def test_default_branch_is_head(self):
        archive = importer._read_ahs_archive(FIXTURES / "multi-branch")
        # HEAD points to main
        turns, _ = importer._project_ahs_to_turns(archive, FIXTURES / "multi-branch")
        self.assertEqual(turns[0]["prompt"][0]["text"], "Main branch prompt")

    def test_explicit_branch_selection(self):
        archive = importer._read_ahs_archive(FIXTURES / "multi-branch", branch="b001")
        turns, _ = importer._project_ahs_to_turns(archive, FIXTURES / "multi-branch")
        self.assertEqual(turns[0]["prompt"][0]["text"], "Branch prompt")

    def test_nonexistent_branch_raises_with_available(self):
        with self.assertRaises(importer.ImportFailure) as failure:
            importer._read_ahs_archive(FIXTURES / "multi-branch", branch="nonexistent")
        self.assertEqual(failure.exception.code, "branch_not_found")
        branch_ids = [b["id"] for b in failure.exception.branches]
        self.assertIn("main", branch_ids)
        self.assertIn("b001", branch_ids)


class LargeOutputTest(unittest.TestCase):
    """Blob externalization and deduplication."""

    def test_large_blob_refs_are_resolved_and_deduplicated(self):
        archive = importer._read_ahs_archive(FIXTURES / "large-output")
        turns, blobs = importer._project_ahs_to_turns(archive, FIXTURES / "large-output")
        tools = [item for item in turns[0]["items"] if item["type"] == "tool"]
        self.assertEqual(len(tools), 2)
        # Both tools reference the same blob (same content → same sha256)
        refs = [tool["rawOutput"]["sha256"] for tool in tools]
        self.assertEqual(refs[0], refs[1])
        # Blob was loaded into the blobs dict
        self.assertEqual(len(blobs), 1)
        self.assertIn(refs[0], blobs)
        self.assertEqual(len(blobs[refs[0]]), 70000)


class ConvertSessionTest(unittest.TestCase):
    """End-to-end convert_session with mocked ahs-export."""

    @staticmethod
    def _dummy_source(fixture):
        """Create a dummy source file named after the fixture's sessionId."""
        manifest = json.loads((FIXTURES / fixture / "manifest.json").read_text())
        session_id = manifest["sessionId"]
        tmp = tempfile.mkdtemp()
        source = Path(tmp) / ("%s.jsonl" % session_id)
        source.write_text("{}", encoding="utf-8")
        return source

    def test_convert_simple_session(self):
        source = self._dummy_source("simple")
        with mock.patch(
            "importer._run_ahs_export",
            side_effect=_mock_ahs_export(FIXTURES / "simple"),
        ):
            result = importer.convert_session(
                "codex",
                source,
                adapter_path="/fake/adapter",
            )
        self.assertEqual(len(result.turns), 2)
        self.assertEqual(result.cwd, "/fixture/project")
        self.assertEqual(result.agent_id, "codex-acp")
        self.assertEqual(result.source_session_id, "codex-fixture")
        self.assertEqual(result.created_at, "2026-01-01T00:00:00Z")
        self.assertEqual(result.updated_at, "2026-01-01T00:00:08Z")
        self.assertEqual(len(result.entry_id), 36)
        self.assertEqual(len(result.history_id), 36)

    def test_convert_multi_branch_defaults_to_head(self):
        source = self._dummy_source("multi-branch")
        with mock.patch(
            "importer._run_ahs_export",
            side_effect=_mock_ahs_export(FIXTURES / "multi-branch"),
        ):
            result = importer.convert_session(
                "claude-code",
                source,
                adapter_path="/fake/adapter",
            )
        self.assertEqual(result.turns[0]["prompt"][0]["text"], "Main branch prompt")

    def test_convert_multi_branch_explicit_selection(self):
        source = self._dummy_source("multi-branch")
        with mock.patch(
            "importer._run_ahs_export",
            side_effect=_mock_ahs_export(FIXTURES / "multi-branch"),
        ):
            result = importer.convert_session(
                "claude-code",
                source,
                adapter_path="/fake/adapter",
                branch="b001",
            )
        self.assertEqual(result.turns[0]["prompt"][0]["text"], "Branch prompt")
        with mock.patch(
            "importer._run_ahs_export",
            side_effect=_mock_ahs_export(FIXTURES / "multi-branch"),
        ):
            main_result = importer.convert_session(
                "claude-code",
                source,
                adapter_path="/fake/adapter",
            )
        self.assertNotEqual(result.entry_id, main_result.entry_id)

    def test_unsupported_harness_raises(self):
        with self.assertRaises(importer.ImportFailure) as failure:
            importer.convert_session("unknown", Path("/fake"), adapter_path="/fake")
        self.assertEqual(failure.exception.code, "source_invalid")


class ImportSessionTest(unittest.TestCase):
    """Full import_session: atomic write, idempotency, conflict, vault boundary."""

    def _import(self, vault, fixture="simple", harness="codex", entry_dir="Sessions", **kwargs):
        # Read the fixture's sessionId so the dummy source filename matches.
        manifest = json.loads((FIXTURES / fixture / "manifest.json").read_text())
        session_id = manifest["sessionId"]
        source = vault / ("%s.jsonl" % session_id)
        source.write_text("{}", encoding="utf-8")
        with mock.patch(
            "importer._run_ahs_export",
            side_effect=_mock_ahs_export(FIXTURES / fixture),
        ):
            return importer.import_session(
                harness, source, vault, entry_dir,
                adapter_path="/fake/adapter",
                **kwargs,
            )

    def test_writes_standard_continuable_session(self):
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory)
            (vault / ".obsidian").mkdir()
            result = self._import(vault)

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
                vault / ".obsidian/plugins/obsidian-harness/sessions"
                / result["historyId"]
            )
            manifest = json.loads((history / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["schemaVersion"], 2)
            self.assertEqual(manifest["metadata"]["agentId"], "codex-acp")
            turns = [
                json.loads(line)
                for line in (history / "turns.jsonl").read_text(encoding="utf-8").splitlines()
            ]
            self.assertEqual(len(turns), 2)
            index = [
                json.loads(line)
                for line in (
                    vault / ".obsidian/plugins/obsidian-harness/sessions/session_index.jsonl"
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
            result = self._import(vault, fixture="large-output")
            history = vault / ".obsidian/plugins/obsidian-harness/sessions" / result["historyId"]
            blobs = list((history / "blobs").iterdir())
            self.assertEqual(len(blobs), 1)
            self.assertIn("xxxx", blobs[0].read_text(encoding="utf-8"))
            turn = json.loads(
                (history / "turns.jsonl").read_text(encoding="utf-8").splitlines()[0]
            )
            refs = [item["rawOutput"]["sha256"] for item in turn["items"] if item["type"] == "tool"]
            self.assertEqual(refs, [refs[0], refs[0]])

    def test_repeat_is_noop_and_conflict_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory)
            (vault / ".obsidian").mkdir()
            first = self._import(vault)
            entry_path = vault / first["entryFile"]
            original = entry_path.read_bytes()
            second = self._import(vault)
            self.assertEqual(second["status"], "already_exists")
            self.assertEqual(entry_path.read_bytes(), original)

            entry_path.write_text("{}", encoding="utf-8")
            with self.assertRaises(importer.ImportFailure) as failure:
                self._import(vault)
            self.assertEqual(failure.exception.code, "target_conflict")
            self.assertEqual(entry_path.read_text(encoding="utf-8"), "{}")

    def test_vault_boundary_violation(self):
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory)
            (vault / ".obsidian").mkdir()
            with self.assertRaises(importer.ImportFailure) as boundary:
                self._import(vault, entry_dir="../outside")
            self.assertEqual(boundary.exception.code, "vault_boundary_violation")

    def test_write_failure_publishes_no_entry(self):
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory)
            (vault / ".obsidian").mkdir()
            with mock.patch("importer._write_sync", side_effect=OSError("injected")):
                with self.assertRaises(importer.ImportFailure) as failure:
                    self._import(vault)
            self.assertEqual(failure.exception.code, "write_failed")
            self.assertFalse(any(vault.rglob("*.session")))

    def test_nonexistent_vault_raises(self):
        with self.assertRaises(importer.ImportFailure) as failure:
            importer.import_session(
                "codex", Path("/fake"), Path("/nonexistent"), "Sessions",
                adapter_path="/fake",
            )
        self.assertEqual(failure.exception.code, "vault_invalid")


class CliTest(unittest.TestCase):
    """CLI entry point error handling."""

    def test_cli_missing_adapter_arg_fails(self):
        original = sys.argv
        try:
            sys.argv = [
                "import_session.py",
                "--harness", "codex",
                "--session", "/fake",
                "--vault", "/fake",
                "--entry-dir", ".",
            ]
            with self.assertRaises(SystemExit):
                import_session.main()
        finally:
            sys.argv = original

    def test_cli_import_failure_returns_exit_2(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / ".obsidian").mkdir()
            # Create a dummy source so source.exists() passes, reaching the
            # adapter check which will fail with adapter_not_found.
            source = Path(directory) / "session.jsonl"
            source.write_text("{}", encoding="utf-8")
            original = sys.argv
            try:
                sys.argv = [
                    "import_session.py",
                    "--harness", "codex",
                    "--session", str(source),
                    "--vault", directory,
                    "--entry-dir", ".",
                    "--adapter", "/nonexistent-adapter",
                ]
                error = io.StringIO()
                with mock.patch("sys.stderr", error):
                    self.assertEqual(import_session.main(), 2)
                self.assertEqual(json.loads(error.getvalue())["code"], "adapter_not_found")
            finally:
                sys.argv = original


if __name__ == "__main__":
    unittest.main()
