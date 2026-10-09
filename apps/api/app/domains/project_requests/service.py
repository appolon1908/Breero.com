import hashlib, json, uuid
from datetime import UTC, datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.domains.booking.models import Customer
from app.domains.common.outbox import AuditLog, EventStatus, IntegrationEvent
from .models import ProjectRequest, ProjectRequestAnswer, ProjectRequestStatus, ProjectRequestStatusHistory
from .schemas import ProjectRequestCreate, ProjectRequestPatch

EDITABLE={ProjectRequestStatus.DRAFT}
TRANSITIONS={ProjectRequestStatus.DRAFT:{ProjectRequestStatus.SUBMITTED,ProjectRequestStatus.CANCELLED},ProjectRequestStatus.SUBMITTED:{ProjectRequestStatus.CANCELLED}}

class ProjectRequestService:
    def __init__(self,session:AsyncSession): self.session=session
    async def customer_for_user(self,user_id:uuid.UUID)->Customer:
        customer=await self.session.scalar(select(Customer).where(Customer.user_id==user_id))
        if not customer: raise PermissionError("Customer profile required")
        return customer
    async def owned(self,request_id:uuid.UUID,customer_id:uuid.UUID,lock=False)->ProjectRequest:
        q=select(ProjectRequest).where(ProjectRequest.id==request_id,ProjectRequest.customer_id==customer_id)
        if lock:q=q.with_for_update()
        item=await self.session.scalar(q)
        if not item: raise LookupError("Project request not found")
        return item
    async def create(self,customer:Customer,payload:ProjectRequestCreate,key:str)->ProjectRequest:
        digest=hashlib.sha256(json.dumps(payload.model_dump(mode="json"),sort_keys=True,separators=(",",":")).encode()).hexdigest()
        existing=await self.session.scalar(select(ProjectRequest).where(ProjectRequest.idempotency_key==key))
        if existing:
            if existing.customer_id!=customer.id or existing.request_hash!=digest: raise ValueError("Idempotency key conflict")
            return existing
        item=ProjectRequest(customer_id=customer.id,service_id=payload.service_id,address_id=payload.address_id,title=payload.title,description=payload.description,idempotency_key=key,request_hash=digest)
        self.session.add(item);await self.session.flush()
        for a in payload.answers:self.session.add(ProjectRequestAnswer(project_request_id=item.id,question_id=a.question_id,value=a.value))
        self._history(item,None,ProjectRequestStatus.DRAFT,customer.user_id,"created")
        self._event(item,"breero.project_request.created")
        await self.session.commit();await self.session.refresh(item);return item
    async def patch(self,item:ProjectRequest,payload:ProjectRequestPatch,expected:int,actor:uuid.UUID)->ProjectRequest:
        if item.version!=expected: raise RuntimeError("VERSION_CONFLICT")
        if item.status not in EDITABLE: raise ValueError("Project request is not editable")
        data=payload.model_dump(exclude_unset=True,exclude={"answers"})
        for k,v in data.items():setattr(item,k,v)
        if payload.answers is not None:
            current=list((await self.session.scalars(select(ProjectRequestAnswer).where(ProjectRequestAnswer.project_request_id==item.id))).all())
            for a in current:await self.session.delete(a)
            for a in payload.answers:self.session.add(ProjectRequestAnswer(project_request_id=item.id,question_id=a.question_id,value=a.value))
        item.version+=1;self._event(item,"breero.project_request.updated");await self.session.commit();await self.session.refresh(item);return item
    async def transition(self,item:ProjectRequest,target:ProjectRequestStatus,actor:uuid.UUID,reason:str)->ProjectRequest:
        if target not in TRANSITIONS.get(item.status,set()):raise ValueError("Invalid project request transition")
        old=item.status;item.status=target;item.version+=1;self._history(item,old,target,actor,reason);self._event(item,f"breero.project_request.{target.value.lower()}");await self.session.commit();await self.session.refresh(item);return item
    def _history(self,item,old,new,actor,reason):self.session.add(ProjectRequestStatusHistory(project_request_id=item.id,from_status=old.value if old else None,to_status=new.value,actor_id=actor,reason=reason,metadata_json={"version":item.version}))
    def _event(self,item,event):self.session.add(IntegrationEvent(aggregate_type="project_request",aggregate_id=item.id,event_type=event,aggregate_version=item.version,idempotency_key=f"{item.id}:{item.version}:{event}",payload={"project_request_id":str(item.id),"customer_id":str(item.customer_id),"status":item.status.value,"version":item.version},status=EventStatus.PENDING_CONFIGURATION,next_attempt_at=datetime.now(UTC)))
