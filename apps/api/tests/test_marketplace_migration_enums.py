"""Compile marketplace migration DDL without connecting to a database."""

import io
import re
import runpy
import unittest
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations" / "versions"
ENUM_TABLES = {
    "033_project_requests.py": {
        "project_request_status": "project_requests",
    },
    "034_marketplace_matching.py": {
        "matching_run_status": "matching_runs",
        "marketplace_opportunity_status": "marketplace_opportunities",
    },
    "035_marketplace_comms.py": {
        "marketplace_quote_status": "marketplace_quotes",
    },
}


def migration_sql(filename: str, direction: str) -> str:
    migration = runpy.run_path(str(MIGRATIONS / filename))
    output = io.StringIO()
    context = MigrationContext.configure(
        dialect_name="postgresql",
        opts={"as_sql": True, "output_buffer": output},
    )
    with Operations.context(context):
        migration[direction]()
    return output.getvalue()


class MarketplaceMigrationEnumTests(unittest.TestCase):
    def test_upgrade_creates_each_enum_once_before_its_table(self) -> None:
        for filename, enum_tables in ENUM_TABLES.items():
            with self.subTest(migration=filename):
                sql = migration_sql(filename, "upgrade")
                created = re.findall(r"CREATE TYPE (\w+) AS ENUM", sql)
                self.assertCountEqual(created, enum_tables)
                for enum_name, table_name in enum_tables.items():
                    self.assertLess(
                        sql.index(f"CREATE TYPE {enum_name} AS ENUM"),
                        sql.index(f"CREATE TABLE {table_name} "),
                    )
                    self.assertRegex(sql, rf"\bstatus {enum_name}\b")

    def test_downgrade_drops_each_enum_once_after_its_table(self) -> None:
        for filename, enum_tables in ENUM_TABLES.items():
            with self.subTest(migration=filename):
                sql = migration_sql(filename, "downgrade")
                dropped = re.findall(r"DROP TYPE (\w+);", sql)
                self.assertCountEqual(dropped, enum_tables)
                for enum_name, table_name in enum_tables.items():
                    self.assertLess(
                        sql.index(f"DROP TABLE {table_name};"),
                        sql.index(f"DROP TYPE {enum_name};"),
                    )


if __name__ == "__main__":
    unittest.main()
