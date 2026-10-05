"""marketplace quotes and conversations
Revision ID: 035_marketplace_comms
Revises: 034_marketplace_matching
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
revision="035_marketplace_comms";down_revision="034_marketplace_matching";branch_labels=None;depends_on=None
def upgrade():
 qs=postgresql.ENUM("DRAFT","SENT","ACCEPTED","DECLINED","EXPIRED","CANCELLED",name="marketplace_quote_status");qs.create(op.get_bind(),checkfirst=True)
 op.create_table("marketplace_quotes",sa.Column("id",postgresql.UUID(as_uuid=True),primary_key=True),sa.Column("lead_connection_id",postgresql.UUID(as_uuid=True),sa.ForeignKey("lead_connections.id",ondelete="CASCADE"),nullable=False),sa.Column("vendor_id",postgresql.UUID(as_uuid=True),sa.ForeignKey("vendors.id",ondelete="CASCADE"),nullable=False),sa.Column("version",sa.Integer(),nullable=False),sa.Column("status",qs,nullable=False,server_default="DRAFT"),sa.Column("currency",sa.String(3),nullable=False),sa.Column("total_amount",sa.Numeric(12,2),nullable=False),sa.Column("line_items",postgresql.JSONB(),nullable=False),sa.Column("terms",sa.Text()),sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.UniqueConstraint("lead_connection_id","version"))
 op.create_table("conversations",sa.Column("id",postgresql.UUID(as_uuid=True),primary_key=True),sa.Column("lead_connection_id",postgresql.UUID(as_uuid=True),sa.ForeignKey("lead_connections.id",ondelete="CASCADE"),nullable=False,unique=True),sa.Column("active",sa.Boolean(),nullable=False,server_default=sa.true()),sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False))
 op.create_table("conversation_messages",sa.Column("id",postgresql.UUID(as_uuid=True),primary_key=True),sa.Column("conversation_id",postgresql.UUID(as_uuid=True),sa.ForeignKey("conversations.id",ondelete="CASCADE"),nullable=False),sa.Column("sender_user_id",postgresql.UUID(as_uuid=True),sa.ForeignKey("users.id",ondelete="RESTRICT"),nullable=False),sa.Column("body",sa.Text(),nullable=False),sa.Column("client_message_id",sa.String(128),nullable=False),sa.Column("metadata_json",postgresql.JSONB(),nullable=False,server_default=sa.text("'{}'::jsonb")),sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.UniqueConstraint("conversation_id","client_message_id"))
def downgrade():
 op.drop_table("conversation_messages");op.drop_table("conversations");op.drop_table("marketplace_quotes");postgresql.ENUM("DRAFT","SENT","ACCEPTED","DECLINED","EXPIRED","CANCELLED",name="marketplace_quote_status").drop(op.get_bind(),checkfirst=True)
