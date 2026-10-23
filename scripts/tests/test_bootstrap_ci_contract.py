from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class ValidatorEntrypointTests(unittest.TestCase):
    def test_orchestrator_validator_is_executable_python(self) -> None:
        path = ROOT / ".codestra" / "validate-production-orchestrator-contract.py"
        compile(path.read_bytes(), str(path), "exec")

    def test_release_self_test_runs_instead_of_silently_succeeding(self) -> None:
        result = subprocess.run(
            [sys.executable, str(ROOT / ".codestra" / "validate-release-intent.py"), "--self-test"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=60,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("RELEASE_INTENT_SELF_TEST=PASS", result.stdout)

    def test_release_validator_rejects_unknown_arguments(self) -> None:
        result = subprocess.run(
            [sys.executable, str(ROOT / ".codestra" / "validate-release-intent.py"), "--invalid-argument"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unsupported arguments", result.stderr)


if __name__ == "__main__":
    unittest.main()
