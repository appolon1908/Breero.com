"""Keep audit queries, ORM mappings, and the shipped migration together."""

from io import StringIO
from pathlib import Path

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy.dialects import postgresql

from app.domains.common.outbox import AuditLog


def test_audit_context_is_migrated_with_its_persisted_model() -> None:
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).parents[1] / "migrations"))
    scripts = ScriptDirectory.from_config(config)
    assert "032_audit_read_model" in {revision.revision for revision in scripts.walk_revisions()}
    migration = scripts.get_revision("032_audit_read_model")
    assert migration is not None
    assert migration.down_revision == "031_provider_catalog"

    output = StringIO()
    context = MigrationContext.configure(
        dialect_name="postgresql",
        opts={
            "as_sql": True,
            "output_buffer": output,
            "target_metadata": AuditLog.metadata,
        },
    )
    with Operations.context(context):
        migration.module.upgrade()
    ddl = output.getvalue()

    for name, sql_type, nullable in (
        ("result", "VARCHAR(16)", False),
        ("request_id", "VARCHAR(128)", True),
        ("correlation_id", "VARCHAR(128)", True),
        ("source_ip_hash", "VARCHAR(64)", True),
        ("vendor_id", "UUID", True),
    ):
        column = AuditLog.__table__.c[name]
        assert str(column.type.compile(dialect=postgresql.dialect())) == sql_type
        assert column.nullable is nullable
        assert f"ALTER TABLE audit_logs ADD COLUMN {name} {sql_type}" in ddl
    # Old records remain valid without updating their append-only history.
    assert "ADD COLUMN result VARCHAR(16) DEFAULT 'success' NOT NULL" in ddl
    assert str(AuditLog.__table__.c.result.server_default.arg) == "success"
    assert "CHECK (result IN ('success', 'denied', 'failure'))" in ddl
    assert "UPDATE audit_logs" not in ddl
    assert "DROP " not in ddl



def test_provider_migration_follows_audit_without_rewriting_audit_history() -> None:
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).parents[1] / "migrations"))
    scripts = ScriptDirectory.from_config(config)
    migration = scripts.get_revision("033_provider_availability_quals")
    assert migration is not None
    assert migration.down_revision == "032_audit_read_model"

    output = StringIO()
    context = MigrationContext.configure(
        dialect_name="postgresql",
        opts={
            "as_sql": True,
            "output_buffer": output,
            "target_metadata": AuditLog.metadata,
        },
    )
    with Operations.context(context):
        migration.module.upgrade()
    ddl = output.getvalue()
    for table in (
        "provider_declared_availability_rules",
        "provider_blackout_periods",
        "provider_qualifications",
    ):
        assert f"CREATE TABLE {table}" in ddl
    for target in ("vendors", "workers", "users"):
        assert f"REFERENCES {target} (id)" in ddl
    for permission in (
        "provider.availability.read",
        "provider.qualifications.manage",
        "provider.offers.decide",
    ):
        assert f"('vendor_admin', '{permission}')" in ddl
    assert "ALTER TABLE audit_logs" not in ddl
    assert "UPDATE audit_logs" not in ddl
    assert "DROP " not in ddl
