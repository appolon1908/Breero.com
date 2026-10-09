"""canonical marketplace project requests
Revision ID: 033_project_requests
Revises: 032_provider_availability_quals
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
revision="033_project_requests";down_revision="032_provider_availability_quals";branch_labels=None;depends_on=None
STATUSES=("DRAFT","SUBMITTED","QUALIFYING","MATCHING","MATCHED","QUOTING","BOOKED","CANCELLED","EXPIRED","UNSERVICEABLE")
def upgrade():
    status=postgresql.ENUM(*STATUSES,name="project_request_status");status.create(op.get_bind(),checkfirst=True)
    op.create_table("project_requests",sa.Column("id",postgresql.UUID(as_uuid=True),primary_key=True),sa.Column("customer_id",postgresql.UUID(as_uuid=True),sa.ForeignKey("customers.id",ondelete="CASCADE"),nullable=False),sa.Column("service_id",postgresql.UUID(as_uuid=True),nullable=False),sa.Column("address_id",postgresql.UUID(as_uuid=True),sa.ForeignKey("addresses.id",ondelete="SET NULL")),sa.Column("title",sa.String(160),nullable=False),sa.Column("description",sa.Text()),sa.Column("status",status,nullable=False,server_default="DRAFT"),sa.Column("version",sa.Integer(),nullable=False,server_default="1"),sa.Column("idempotency_key",sa.String(128),nullable=False,unique=True),sa.Column("request_hash",sa.String(64),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),sa.Column("updated_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()))
    op.create_index("ix_project_requests_customer_id","project_requests",["customer_id"]);op.create_index("ix_project_requests_service_id","project_requests",["service_id"]);op.create_index("ix_project_requests_status","project_requests",["status"])
    op.create_table("project_request_answers",sa.Column("id",postgresql.UUID(as_uuid=True),primary_key=True),sa.Column("project_request_id",postgresql.UUID(as_uuid=True),sa.ForeignKey("project_requests.id",ondelete="CASCADE"),nullable=False),sa.Column("question_id",postgresql.UUID(as_uuid=True),nullable=False),sa.Column("value",postgresql.JSONB(),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),sa.Column("updated_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),sa.UniqueConstraint("project_request_id","question_id"))
    op.create_table("project_request_status_history",sa.Column("id",postgresql.UUID(as_uuid=True),primary_key=True),sa.Column("project_request_id",postgresql.UUID(as_uuid=True),sa.ForeignKey("project_requests.id",ondelete="CASCADE"),nullable=False),sa.Column("from_status",sa.String(32)),sa.Column("to_status",sa.String(32),nullable=False),sa.Column("actor_id",postgresql.UUID(as_uuid=True)),sa.Column("reason",sa.String(500)),sa.Column("metadata_json",postgresql.JSONB(),nullable=False,server_default=sa.text("'{}'::jsonb")))
def downgrade():
    op.drop_table("project_request_status_history");op.drop_table("project_request_answers");op.drop_table("project_requests");postgresql.ENUM(*STATUSES,name="project_request_status").drop(op.get_bind(),checkfirst=True)
