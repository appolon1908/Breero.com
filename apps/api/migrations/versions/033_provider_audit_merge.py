"""Join provider availability/qualification and audit migration histories.

Revision ID: 033_provider_audit_merge
Revises: 032_provider_availability_quals, 032_audit_read_model

Both feature migrations remain unchanged. This merge revision records their
convergence and performs no schema or data operations.
"""

revision = "033_provider_audit_merge"
down_revision = ("032_provider_availability_quals", "032_audit_read_model")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
