"""Schema tools must load complete metadata without incidental API imports."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parents[1]

METADATA_PROBE = r"""
import ast
import importlib
import sys
from pathlib import Path

source = Path(sys.argv[1])
for node in ast.parse(source.read_text(encoding="utf-8-sig")).body:
    if isinstance(node, ast.ImportFrom) and node.module.startswith("app.domains."):
        for model in node.names:
            importlib.import_module(f"{node.module}.{model.name}")

from app.db.base import Base

required_tables = {
    "audit_logs",
    "feature_flags",
    "operating_hours",
    "service_zones",
    "booking_capacity_holds",
    "provider_services",
    "provider_skills",
    "provider_service_areas",
    "provider_declared_availability_rules",
    "provider_blackout_periods",
    "provider_qualifications",
}
missing = required_tables.difference(Base.metadata.tables)
assert not missing, f"{source}: missing application tables: {sorted(missing)}"
assert {"result", "request_id", "correlation_id", "source_ip_hash", "vendor_id"} <= set(
    Base.metadata.tables["audit_logs"].columns.keys()
)
for table in Base.metadata.tables.values():
    for foreign_key in table.foreign_keys:
        assert foreign_key.column.table.name in Base.metadata.tables
"""


@pytest.mark.parametrize("entrypoint", ["migrations/env.py", "scripts/check_schema_drift.py"])
def test_schema_entrypoint_registers_complete_resolvable_metadata(entrypoint: str) -> None:
    # Fresh interpreters prevent other tests from registering missing models by accident.
    result = subprocess.run(
        [sys.executable, "-c", METADATA_PROBE, entrypoint],
        cwd=API_ROOT,
        env={**os.environ, "PYTHONPATH": str(API_ROOT)},
        capture_output=True,
        text=True,
        check=False,
        timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr
