import enum
import uuid
from sqlalchemy import Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
from app.domains.common.models import TimestampMixin, UUIDPrimaryKeyMixin

class ProjectRequestStatus(str, enum.Enum):
    DRAFT="DRAFT"; SUBMITTED="SUBMITTED"; QUALIFYING="QUALIFYING"; MATCHING="MATCHING"; MATCHED="MATCHED"; QUOTING="QUOTING"; BOOKED="BOOKED"; CANCELLED="CANCELLED"; EXPIRED="EXPIRED"; UNSERVICEABLE="UNSERVICEABLE"

class ProjectRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__="project_requests"
    customer_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("customers.id",ondelete="CASCADE"),index=True)
    service_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),index=True)
    address_id: Mapped[uuid.UUID|None]=mapped_column(ForeignKey("addresses.id",ondelete="SET NULL"),index=True)
    title: Mapped[str]=mapped_column(String(160),nullable=False)
    description: Mapped[str|None]=mapped_column(Text)
    status: Mapped[ProjectRequestStatus]=mapped_column(Enum(ProjectRequestStatus,name="project_request_status"),nullable=False,default=ProjectRequestStatus.DRAFT,index=True)
    version: Mapped[int]=mapped_column(Integer,nullable=False,default=1)
    idempotency_key: Mapped[str]=mapped_column(String(128),nullable=False,unique=True)
    request_hash: Mapped[str]=mapped_column(String(64),nullable=False)

class ProjectRequestAnswer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__="project_request_answers"; __table_args__=(UniqueConstraint("project_request_id","question_id"),)
    project_request_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("project_requests.id",ondelete="CASCADE"),index=True)
    question_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True))
    value: Mapped[dict]=mapped_column(JSONB,nullable=False)

class ProjectRequestStatusHistory(UUIDPrimaryKeyMixin, Base):
    __tablename__="project_request_status_history"
    project_request_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("project_requests.id",ondelete="CASCADE"),index=True)
    from_status: Mapped[str|None]=mapped_column(String(32))
    to_status: Mapped[str]=mapped_column(String(32),nullable=False)
    actor_id: Mapped[uuid.UUID|None]=mapped_column(UUID(as_uuid=True),index=True)
    reason: Mapped[str|None]=mapped_column(String(500))
    metadata_json: Mapped[dict]=mapped_column(JSONB,nullable=False,default=dict)
