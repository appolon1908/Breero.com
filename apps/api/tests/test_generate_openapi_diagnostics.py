"""Exercise contract artifact diagnostics without importing the API runtime."""

import contextlib
import io
import json
import os
import runpy
import sys
import tempfile
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

GENERATOR = Path(__file__).resolve().parents[1] / "scripts" / "generate_openapi.py"


class OpenApiArtifactDiagnosticTests(unittest.TestCase):
    def run_generator(self, stale_artifact: str | None) -> tuple[str, str]:
        schema = {"paths": {}, "x-breero-endpoint-registry-digest": "sha256:test"}
        registry = {"digest": "sha256:test", "endpoints": []}
        policy_module = ModuleType("app.api.policy_registry")
        policy_module.get_endpoint_registry = lambda app: registry
        policy_module.iter_api_route_contexts = lambda app: ()
        main_module = ModuleType("app.main")
        main_module.app = type("FakeApp", (), {"openapi": lambda self: schema})()
        modules = {
            "app": ModuleType("app"),
            "app.api": ModuleType("app.api"),
            "app.api.policy_registry": policy_module,
            "app.main": main_module,
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            targets = {"openapi.json": schema, "endpoint-registry.json": registry}
            for name, document in targets.items():
                content = "{}\n" if name == stale_artifact else json.dumps(
                    document, indent=2, sort_keys=True
                ) + "\n"
                (root / name).write_text(content)
            before = {name: (root / name).read_bytes() for name in targets}
            output = io.StringIO()
            errors = io.StringIO()
            with (
                patch.dict(sys.modules, modules),
                patch.dict(os.environ, {
                    "OPENAPI_PATH": str(root / "openapi.json"),
                    "ENDPOINT_REGISTRY_PATH": str(root / "endpoint-registry.json"),
                }),
                patch.object(sys, "argv", [str(GENERATOR), "--check"]),
                contextlib.redirect_stdout(output),
                contextlib.redirect_stderr(errors),
            ):
                if stale_artifact:
                    with self.assertRaises(SystemExit) as caught:
                        runpy.run_path(str(GENERATOR), run_name="__main__")
                    self.assertIn("Stale generated artifact:", str(caught.exception))
                else:
                    runpy.run_path(str(GENERATOR), run_name="__main__")
            self.assertEqual(before, {name: (root / name).read_bytes() for name in targets})
            return output.getvalue(), errors.getvalue()

    def test_stale_artifact_reports_diff_and_still_fails(self) -> None:
        for name in ("openapi.json", "endpoint-registry.json"):
            with self.subTest(artifact=name):
                _, errors = self.run_generator(name)
                self.assertIn(f"--- committed/{name}\n", errors)
                self.assertIn(f"+++ generated/{name}\n", errors)
                self.assertIn("+", errors)
                self.assertIn("sha256:test", errors)

    def test_matching_artifacts_pass_without_diff(self) -> None:
        output, errors = self.run_generator(None)
        self.assertIn("validated 0 paths / 0 operations / 0 endpoint policies", output)
        self.assertEqual(errors, "")


if __name__ == "__main__":
    unittest.main()
