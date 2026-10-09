import uuid
from typing import Annotated
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.domains.auth.dependencies import require_roles
from app.domains.auth.models import User,UserRole
from app.domains.marketplace.models import Opportunity
from app.domains.marketplace.service import MarketplaceService
from app.domains.workforce.provider_scope import provider_vendor

router=APIRouter()
class OpportunityRead(BaseModel):
 model_config=ConfigDict(from_attributes=True);id:uuid.UUID;project_request_id:uuid.UUID;vendor_id:uuid.UUID;status:str;version:int
class Decision(BaseModel):accept:bool

@router.post("/matching/project-requests/{request_id}",include_in_schema=False)
async def match(request_id:uuid.UUID,user:Annotated[User,Depends(require_roles(UserRole.operations,UserRole.admin))],db:Annotated[AsyncSession,Depends(get_db)]):
 try:return {"matching_run_id":str((await MarketplaceService(db).run_matching(request_id)).id)}
 except Exception as e:raise HTTPException(409,str(e))
@router.post("/opportunities/project-requests/{request_id}/providers/{vendor_id}",response_model=OpportunityRead,include_in_schema=False)
async def offer(request_id:uuid.UUID,vendor_id:uuid.UUID,user:Annotated[User,Depends(require_roles(UserRole.operations,UserRole.admin))],db:Annotated[AsyncSession,Depends(get_db)]):
 try:return await MarketplaceService(db).offer(request_id,vendor_id)
 except PermissionError as e:raise HTTPException(403,str(e))
 except Exception as e:raise HTTPException(409,str(e))
@router.get("/opportunities",response_model=list[OpportunityRead])
async def list_opportunities(user:Annotated[User,Depends(require_roles(UserRole.vendor_admin))],db:Annotated[AsyncSession,Depends(get_db)]):
 vendor=await provider_vendor(db,user);return list((await db.scalars(select(Opportunity).where(Opportunity.vendor_id==vendor.id).order_by(Opportunity.created_at.desc()))).all())
@router.post("/opportunities/{opportunity_id}/decision")
async def decide(opportunity_id:uuid.UUID,payload:Decision,user:Annotated[User,Depends(require_roles(UserRole.vendor_admin))],db:Annotated[AsyncSession,Depends(get_db)]):
 vendor=await provider_vendor(db,user,write=True)
 try:
  opportunity,connection=await MarketplaceService(db).decide(opportunity_id,vendor.id,payload.accept)
  return {"opportunity_id":str(opportunity.id),"status":opportunity.status.value,"lead_connection_id":str(connection.id) if connection else None}
 except LookupError as e:raise HTTPException(404,str(e))
 except Exception as e:raise HTTPException(409,str(e))
