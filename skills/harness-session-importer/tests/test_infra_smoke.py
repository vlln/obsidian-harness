import json
import os
import sys
import unittest
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL_ROOT / "scripts"))

import runtime  # noqa: E402


class ImporterInfrastructureSmokeTest(unittest.TestCase):
    def test_shared_contract_vector_matches_runtime_constants(self):
        vector_path = Path(os.environ["SESSION_IMPORT_CONTRACT_FIXTURE"])
        vector = json.loads(vector_path.read_text(encoding="utf-8"))

        self.assertEqual(vector["schemaVersion"], runtime.BUNDLE_SCHEMA_VERSION)
        self.assertEqual(vector["importNamespace"], runtime.IMPORT_NAMESPACE)

        import importer

        self.assertEqual(
            importer.canonical_json(vector["jcs"]["input"]),
            vector["jcs"]["canonical"],
        )
        identity = vector["identity"]
        canonical = importer.canonical_json(identity["input"])
        self.assertEqual(canonical, identity["canonical"])
        import_id = importer._stable_uuid(runtime.IMPORT_NAMESPACE, canonical)
        self.assertEqual(import_id, identity["importId"])
        self.assertEqual(importer._stable_uuid(import_id, "entry"), identity["entryId"])
        self.assertEqual(importer._stable_uuid(import_id, "history"), identity["historyId"])


if __name__ == "__main__":
    unittest.main()
