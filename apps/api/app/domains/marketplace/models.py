import enum, uuid
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
from app.domains.common.models import TimestampMixin, UUIDPrimaryKeyMixin
class MatchStatus(str,enum.Enum): OPEN="OPEN"; COMPLETE="COMPLETE"
class OpportunityStatus(str,enum.Enum): OFFERED="OFFERED"; ACCEPTED="ACCEPTED"; DECLINED="DECLINED"; EXPIRED="EXPIRED"
class MatchingRun(UUIDPrimaryKeyMixin,TimestampMixin,Base):
 __tablename__="matching_runs"; project_request_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("project_requests.id",ondelete="CASCADE"),index=True);status:Mapped[MatchStatus]=mapped_column(Enum(MatchStatus,name="matching_run_status"),default=MatchStatus.OPEN);version:Mapped[int]=mapped_column(Integer,default=1)
class MatchCandidate(UUIDPrimaryKeyMixin,TimestampMixin,Base):
 __tablename__="match_candidates";__table_args__=(UniqueConstraint("matching_run_id","vendor_id"),);matching_run_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("matching_runs.id",ondelete="CASCADE"),index=True);vendor_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("vendors.id",ondelete="CASCADE"),index=True);score:Mapped[int]=mapped_column(Integer,nullable=False,default=0);reasons:Mapped[dict]=mapped_column(JSONB,nullable=False,default=dict);eligible:Mapped[bool]=mapped_column(nullable=False,default=True)
class Opportunity(UUIDPrimaryKeyMixin,TimestampMixin,Base):
 __tablename__="marketplace_opportunities";__table_args__=(UniqueConstraint("project_request_id","vendor_id"),);project_request_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("project_requests.id",ondelete="CASCADE"),index=True);vendor_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("vendors.id",ondelete="CASCADE"),index=True);status:Mapped[OpportunityStatus]=mapped_column(Enum(OpportunityStatus,name="marketplace_opportunity_status"),default=OpportunityStatus.OFFERED,index=True);version:Mapped[int]=mapped_column(Integer,default=1)
class LeadConnection(UUIDPrimaryKeyMixin,TimestampMixin,Base):
 __tablename__="lead_connections";__table_args__=(UniqueConstraint("project_request_id","vendor_id"),);project_request_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("project_requests.id",ondelete="CASCADE"),index=True);vendor_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("vendors.id",ondelete="CASCADE"),index=True);opportunity_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("marketplace_opportunities.id",ondelete="CASCADE"),unique=True);active:Mapped[bool]=mapped_column(nullable=False,default=True)
