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


if __name__ == "__main__":
    unittest.main()
