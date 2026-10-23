"""Offline checks for the joined provider and audit migration histories."""

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_provider_and_audit_histories_reach_one_migration_head() -> None:
    api_root = Path(__file__).resolve().parents[1]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "migrations"))
    script = ScriptDirectory.from_config(config)

    heads = script.get_heads()
    assert len(heads) == 1, f"Expected one deployable migration head, found {heads}"
    ancestors = {
        revision.revision for revision in script.walk_revisions(base="base", head=heads[0])
    }
    assert {
        "032_provider_availability_quals",
        "032_audit_read_model",
    } <= ancestors
