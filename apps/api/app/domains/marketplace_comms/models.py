import enum,uuid
from decimal import Decimal
from sqlalchemy import Enum,ForeignKey,Integer,Numeric,String,Text,UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB,UUID
from sqlalchemy.orm import Mapped,mapped_column
from app.db.base import Base
from app.domains.common.models import TimestampMixin,UUIDPrimaryKeyMixin
class QuoteStatus(str,enum.Enum): DRAFT="DRAFT"; SENT="SENT"; ACCEPTED="ACCEPTED"; DECLINED="DECLINED"; EXPIRED="EXPIRED"; CANCELLED="CANCELLED"
class Quote(UUIDPrimaryKeyMixin,TimestampMixin,Base):
 __tablename__="marketplace_quotes";__table_args__=(UniqueConstraint("lead_connection_id","version"),);lead_connection_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("lead_connections.id",ondelete="CASCADE"),index=True);vendor_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("vendors.id",ondelete="CASCADE"),index=True);version:Mapped[int]=mapped_column(Integer,nullable=False);status:Mapped[QuoteStatus]=mapped_column(Enum(QuoteStatus,name="marketplace_quote_status"),default=QuoteStatus.DRAFT,index=True);currency:Mapped[str]=mapped_column(String(3),nullable=False);total_amount:Mapped[Decimal]=mapped_column(Numeric(12,2),nullable=False);line_items:Mapped[list]=mapped_column(JSONB,nullable=False);terms:Mapped[str|None]=mapped_column(Text)
class Conversation(UUIDPrimaryKeyMixin,TimestampMixin,Base):
 __tablename__="conversations";lead_connection_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("lead_connections.id",ondelete="CASCADE"),unique=True,index=True);active:Mapped[bool]=mapped_column(nullable=False,default=True)
class Message(UUIDPrimaryKeyMixin,TimestampMixin,Base):
 __tablename__="conversation_messages";conversation_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("conversations.id",ondelete="CASCADE"),index=True);sender_user_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="RESTRICT"),index=True);body:Mapped[str]=mapped_column(Text,nullable=False);client_message_id:Mapped[str]=mapped_column(String(128),nullable=False);metadata_json:Mapped[dict]=mapped_column(JSONB,nullable=False,default=dict);__table_args__=(UniqueConstraint("conversation_id","client_message_id"),)
