import uuid
from datetime import UTC,datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.domains.booking.models import Address
from app.domains.common.outbox import EventStatus,IntegrationEvent
from app.domains.project_requests.models import ProjectRequest,ProjectRequestStatus
from app.domains.workforce.models import Vendor,VendorStatus
from app.domains.workforce.provider_models import ProviderService,ProviderServiceArea
from .models import MatchingRun,MatchCandidate,MatchStatus,Opportunity,OpportunityStatus,LeadConnection

class MarketplaceService:
 def __init__(self,session:AsyncSession):self.session=session
 async def run_matching(self,request_id:uuid.UUID)->MatchingRun:
  req=await self.session.scalar(select(ProjectRequest).where(ProjectRequest.id==request_id).with_for_update())
  if not req or req.status not in {ProjectRequestStatus.SUBMITTED,ProjectRequestStatus.QUALIFYING}:raise ValueError("Project request is not matchable")
  address=await self.session.get(Address,req.address_id) if req.address_id else None
  run=MatchingRun(project_request_id=req.id);self.session.add(run);await self.session.flush()
  q=select(Vendor).join(ProviderService,ProviderService.provider_id==Vendor.id).where(Vendor.status==VendorStatus.ACTIVE,ProviderService.service_id==req.service_id,ProviderService.active.is_(True),ProviderService.approval_status=="APPROVED")
  if address:q=q.join(ProviderServiceArea,ProviderServiceArea.provider_id==Vendor.id).where(ProviderServiceArea.active.is_(True),ProviderServiceArea.approval_status=="APPROVED",ProviderServiceArea.postal_code==address.postal_code[:5])
  vendors=list((await self.session.scalars(q.distinct())).all())
  for v in vendors:self.session.add(MatchCandidate(matching_run_id=run.id,vendor_id=v.id,score=100,reasons={"service":True,"area":bool(address)},eligible=True))
  run.status=MatchStatus.COMPLETE;req.status=ProjectRequestStatus.MATCHING;req.version+=1
  self._event(req.id,req.version,"breero.project_request.matching",{"candidate_count":len(vendors)})
  await self.session.commit();return run
 async def offer(self,request_id:uuid.UUID,vendor_id:uuid.UUID)->Opportunity:
  req=await self.session.scalar(select(ProjectRequest).where(ProjectRequest.id==request_id).with_for_update())
  if not req or req.status not in {ProjectRequestStatus.MATCHING,ProjectRequestStatus.MATCHED}:raise ValueError("Project request is not ready for opportunity")
  candidate=await self.session.scalar(select(MatchCandidate).join(MatchingRun).where(MatchingRun.project_request_id==request_id,MatchCandidate.vendor_id==vendor_id,MatchCandidate.eligible.is_(True)))
  if not candidate:raise PermissionError("Provider is not an eligible candidate")
  existing=await self.session.scalar(select(Opportunity).where(Opportunity.project_request_id==request_id,Opportunity.vendor_id==vendor_id))
  if existing:return existing
  item=Opportunity(project_request_id=request_id,vendor_id=vendor_id);self.session.add(item);req.status=ProjectRequestStatus.MATCHED;req.version+=1;await self.session.flush();self._event(req.id,req.version,"breero.opportunity.offered",{"opportunity_id":str(item.id),"vendor_id":str(vendor_id)});await self.session.commit();return item
 async def decide(self,opportunity_id:uuid.UUID,vendor_id:uuid.UUID,accept:bool)->tuple[Opportunity,LeadConnection|None]:
  item=await self.session.scalar(select(Opportunity).where(Opportunity.id==opportunity_id,Opportunity.vendor_id==vendor_id).with_for_update())
  if not item:raise LookupError("Opportunity not found")
  if item.status!=OpportunityStatus.OFFERED:raise ValueError("Opportunity already decided")
  item.status=OpportunityStatus.ACCEPTED if accept else OpportunityStatus.DECLINED;item.version+=1;connection=None
  if accept:
   connection=await self.session.scalar(select(LeadConnection).where(LeadConnection.project_request_id==item.project_request_id,LeadConnection.vendor_id==vendor_id))
   if not connection:connection=LeadConnection(project_request_id=item.project_request_id,vendor_id=vendor_id,opportunity_id=item.id);self.session.add(connection)
  self._event(item.project_request_id,item.version,"breero.opportunity.accepted" if accept else "breero.opportunity.declined",{"opportunity_id":str(item.id),"vendor_id":str(vendor_id)})
  await self.session.commit();return item,connection
 def _event(self,aggregate_id,version,event,payload):self.session.add(IntegrationEvent(aggregate_type="project_request",aggregate_id=aggregate_id,event_type=event,aggregate_version=version,idempotency_key=f"{aggregate_id}:{version}:{event}",payload=payload,status=EventStatus.PENDING_CONFIGURATION,next_attempt_at=datetime.now(UTC)))
