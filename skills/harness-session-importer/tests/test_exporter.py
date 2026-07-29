"""Coverage-restoration tests for importer internals (BL-0011).

Covers units that the fixture-level tests in test_converter.py mock away or
do not exercise: the ahs-export subprocess wrapper, AHS archive error paths,
projection skip-record types, tool-kind mapping branches, usage conversion
edges and ImportFailure serialization.
"""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SKILL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL_ROOT / "scripts"))

import importer  # noqa: E402


def _completed(returncode=0, stdout="", stderr=""):
    return subprocess.CompletedProcess(args=[], returncode=returncode,
                                       stdout=stdout, stderr=stderr)


class RunAhsExportTest(unittest.TestCase):
    """_run_ahs_export subprocess wrapper (mocked subprocess.run)."""

    def _adapter(self, tmp, with_script=True):
        adapter = Path(tmp) / "adapter"
        script = adapter / "examples" / "ahs-export.ts"
        if with_script:
            script.parent.mkdir(parents=True)
            script.write_text("// stub", encoding="utf-8")
        return adapter

    def test_missing_export_script_raises_adapter_not_found(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = self._adapter(tmp, with_script=False)
            with self.assertRaises(importer.ImportFailure) as ctx:
                importer._run_ahs_export(adapter, "codex", "s1", Path(tmp) / "out")
            self.assertEqual(ctx.exception.code, "adapter_not_found")

    def test_success_returns_parsed_output_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = self._adapter(tmp)
            with mock.patch.object(subprocess, "run") as run:
                run.return_value = _completed(
                    stdout="exported s1: 3 records, 1 blobs → /tmp/out/s1\n")
                result = importer._run_ahs_export(adapter, "codex", "s1",
                                                  Path(tmp) / "out")
            self.assertEqual(result, Path("/tmp/out/s1"))
            cmd = run.call_args[0][0]
            self.assertEqual(cmd[0:2], ["npx", "vite-node"])
            self.assertIn("ahs-export.ts", cmd[2])

    def test_missing_npx_raises_node_not_found(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = self._adapter(tmp)
            with mock.patch.object(subprocess, "run",
                                   side_effect=FileNotFoundError()):
                with self.assertRaises(importer.ImportFailure) as ctx:
                    importer._run_ahs_export(adapter, "codex", "s1", tmp)
            self.assertEqual(ctx.exception.code, "node_not_found")

    def test_timeout_raises_export_timeout(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = self._adapter(tmp)
            with mock.patch.object(
                    subprocess, "run",
                    side_effect=subprocess.TimeoutExpired(cmd="npx", timeout=120)):
                with self.assertRaises(importer.ImportFailure) as ctx:
                    importer._run_ahs_export(adapter, "codex", "s1", tmp)
            self.assertEqual(ctx.exception.code, "export_timeout")

    def test_session_not_found_maps_to_source_not_found(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = self._adapter(tmp)
            stderr = ("(node:123) ExperimentalWarning: trace-warnings\n"
                      "Error: session not found: s1\n")
            with mock.patch.object(subprocess, "run") as run:
                run.return_value = _completed(returncode=1, stderr=stderr)
                with self.assertRaises(importer.ImportFailure) as ctx:
                    importer._run_ahs_export(adapter, "codex", "s1", tmp)
            self.assertEqual(ctx.exception.code, "source_not_found")
            # Node warning lines are filtered out of the message.
            self.assertNotIn("trace-warnings", str(ctx.exception))

    def test_unknown_harness_maps_to_source_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = self._adapter(tmp)
            with mock.patch.object(subprocess, "run") as run:
                run.return_value = _completed(returncode=1,
                                              stderr="unknown harness: foo\n")
                with self.assertRaises(importer.ImportFailure) as ctx:
                    importer._run_ahs_export(adapter, "foo", "s1", tmp)
            self.assertEqual(ctx.exception.code, "source_invalid")

    def test_generic_failure_raises_export_failed(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = self._adapter(tmp)
            with mock.patch.object(subprocess, "run") as run:
                run.return_value = _completed(returncode=1,
                                              stderr="something broke\n")
                with self.assertRaises(importer.ImportFailure) as ctx:
                    importer._run_ahs_export(adapter, "codex", "s1", tmp)
            self.assertEqual(ctx.exception.code, "export_failed")
            self.assertIn("something broke", str(ctx.exception))

    def test_unparseable_stdout_raises_export_failed(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = self._adapter(tmp)
            with mock.patch.object(subprocess, "run") as run:
                run.return_value = _completed(stdout="no arrow here\n")
                with self.assertRaises(importer.ImportFailure) as ctx:
                    importer._run_ahs_export(adapter, "codex", "s1", tmp)
            self.assertEqual(ctx.exception.code, "export_failed")


class ReadAhsArchiveErrorTest(unittest.TestCase):
    """_read_ahs_archive error paths."""

    def _archive_dir(self, tmp, manifest='{"HEAD": {"branch": "main"}}',
                     records=None):
        root = Path(tmp) / "sess"
        if manifest is not None:
            root.mkdir(parents=True, exist_ok=True)
            (root / "manifest.json").write_text(manifest, encoding="utf-8")
        if records is not None:
            rec_dir = root / "records"
            rec_dir.mkdir(parents=True, exist_ok=True)
            (rec_dir / "main.jsonl").write_text(records, encoding="utf-8")
        return root

    def test_missing_manifest_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self._archive_dir(tmp, manifest=None)
            with self.assertRaises(importer.ImportFailure) as ctx:
                importer._read_ahs_archive(root)
            self.assertEqual(ctx.exception.code, "ahs_invalid")

    def test_invalid_manifest_json_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self._archive_dir(tmp, manifest="{not json")
            with self.assertRaises(importer.ImportFailure) as ctx:
                importer._read_ahs_archive(root)
            self.assertEqual(ctx.exception.code, "ahs_invalid")

    def test_invalid_record_line_raises_with_line_number(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self._archive_dir(
                tmp, records='{"type": "compaction"}\n{bad json\n')
            with self.assertRaises(importer.ImportFailure) as ctx:
                importer._read_ahs_archive(root)
            self.assertEqual(ctx.exception.code, "ahs_invalid")
            self.assertEqual(ctx.exception.line, 2)

    def test_blank_record_lines_are_skipped(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self._archive_dir(
                tmp, records='\n{"type": "compaction"}\n\n')
            archive = importer._read_ahs_archive(root)
            self.assertEqual(len(archive.records), 1)

    def test_records_file_open_failure_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self._archive_dir(tmp, records='{"type": "compaction"}\n')
            real_open = Path.open

            def fail_records_open(self_path, *args, **kwargs):
                if "records" in str(self_path):
                    raise FileNotFoundError()
                return real_open(self_path, *args, **kwargs)

            with mock.patch.object(Path, "open", fail_records_open):
                with self.assertRaises(importer.ImportFailure) as ctx:
                    importer._read_ahs_archive(root)
            self.assertEqual(ctx.exception.code, "ahs_invalid")


class ProjectionSkipTypesTest(unittest.TestCase):
    """model_change / compaction / goal_update records are dropped."""

    def test_skip_record_types_produce_no_turns_or_items(self):
        archive = importer.AhsArchive(
            manifest={},
            records=[
                {"type": "model_change", "model": "x"},
                {"type": "compaction"},
                {"type": "goal_update"},
            ],
        )
        turns, blobs = importer._project_ahs_to_turns(archive, ".")
        self.assertEqual(turns, [])
        self.assertEqual(blobs, {})


class ToolKindTest(unittest.TestCase):
    """_tool_kind branch coverage."""

    def test_all_kind_buckets(self):
        self.assertEqual(importer._tool_kind("Read"), "read")
        self.assertEqual(importer._tool_kind("apply_patch"), "edit")
        self.assertEqual(importer._tool_kind("exec_command"), "execute")
        self.assertEqual(importer._tool_kind("WebFetch"), "fetch")
        self.assertEqual(importer._tool_kind("mystery"), "other")
        self.assertEqual(importer._tool_kind(None), "other")


class UsageConversionTest(unittest.TestCase):
    """_ahs_usage_to_obsidian edge cases."""

    def test_non_dict_returns_none(self):
        self.assertIsNone(importer._ahs_usage_to_obsidian("nope"))

    def test_used_sums_input_and_cache_read(self):
        result = importer._ahs_usage_to_obsidian(
            {"inputTokens": 10, "cacheReadTokens": 5, "outputTokens": 3})
        self.assertEqual(result, {"used": 15, "size": 0})

    def test_cost_carried_with_defaults(self):
        result = importer._ahs_usage_to_obsidian(
            {"inputTokens": 1, "cost": {"amount": 0.5}})
        self.assertEqual(result["cost"],
                         {"amount": 0.5, "currency": "USD"})


class ImportFailureTest(unittest.TestCase):
    """ImportFailure.as_dict optional fields."""

    def test_path_and_line_included_when_present(self):
        err = importer.ImportFailure("export_failed", "boom",
                                     Path("/tmp/x"), 3)
        result = err.as_dict()
        self.assertEqual(result["path"], "/tmp/x")
        self.assertEqual(result["line"], 3)
        self.assertNotIn("branches", result)

    def test_branches_included_when_present(self):
        err = importer.ImportFailure("branch_not_found", "nope",
                                     branches=[{"id": "main", "label": "main"}])
        result = err.as_dict()
        self.assertEqual(result["branches"],
                         [{"id": "main", "label": "main"}])
        self.assertNotIn("path", result)


if __name__ == "__main__":
    unittest.main()
