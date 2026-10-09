import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.domains.auth.dependencies import require_roles
from app.domains.auth.models import User, UserRole
from app.domains.project_requests.models import ProjectRequestStatus
from app.domains.project_requests.schemas import ProjectRequestCreate, ProjectRequestPatch, ProjectRequestRead
from app.domains.project_requests.service import ProjectRequestService

router=APIRouter(prefix="/project-requests")
CustomerUser=Annotated[User,Depends(require_roles(UserRole.customer))]
Db=Annotated[AsyncSession,Depends(get_db)]

def version(value:str)->int:
    try:return int(value.strip().strip('"'))
    except Exception as exc:raise HTTPException(400,"Invalid If-Match version") from exc
def translate(exc:Exception):
    if isinstance(exc,PermissionError):raise HTTPException(403,str(exc))
    if isinstance(exc,LookupError):raise HTTPException(404,str(exc))
    if isinstance(exc,RuntimeError):raise HTTPException(409,str(exc))
    if isinstance(exc,ValueError):raise HTTPException(409,str(exc))
    raise exc

@router.post("",response_model=ProjectRequestRead,status_code=status.HTTP_201_CREATED)
async def create(payload:ProjectRequestCreate,user:CustomerUser,db:Db,idempotency_key:Annotated[str,Header(alias="Idempotency-Key",min_length=8,max_length=128)]):
    service=ProjectRequestService(db)
    try:return await service.create(await service.customer_for_user(user.id),payload,idempotency_key)
    except Exception as exc:translate(exc)

@router.get("/{request_id}",response_model=ProjectRequestRead)
async def get(request_id:uuid.UUID,user:CustomerUser,db:Db):
    service=ProjectRequestService(db)
    try:return await service.owned(request_id,(await service.customer_for_user(user.id)).id)
    except Exception as exc:translate(exc)

@router.patch("/{request_id}",response_model=ProjectRequestRead)
async def patch(request_id:uuid.UUID,payload:ProjectRequestPatch,user:CustomerUser,db:Db,if_match:Annotated[str,Header(alias="If-Match")]):
    service=ProjectRequestService(db)
    try:
        customer=await service.customer_for_user(user.id);item=await service.owned(request_id,customer.id,True)
        return await service.patch(item,payload,version(if_match),user.id)
    except Exception as exc:translate(exc)

@router.post("/{request_id}/submit",response_model=ProjectRequestRead)
async def submit(request_id:uuid.UUID,user:CustomerUser,db:Db):
    service=ProjectRequestService(db)
    try:
        customer=await service.customer_for_user(user.id);item=await service.owned(request_id,customer.id,True)
        return await service.transition(item,ProjectRequestStatus.SUBMITTED,user.id,"customer_submit")
    except Exception as exc:translate(exc)

@router.post("/{request_id}/cancel",response_model=ProjectRequestRead)
async def cancel(request_id:uuid.UUID,user:CustomerUser,db:Db):
    service=ProjectRequestService(db)
    try:
        customer=await service.customer_for_user(user.id);item=await service.owned(request_id,customer.id,True)
        return await service.transition(item,ProjectRequestStatus.CANCELLED,user.id,"customer_cancel")
    except Exception as exc:translate(exc)
