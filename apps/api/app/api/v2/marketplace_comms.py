import uuid
from typing import Annotated
from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.domains.auth.dependencies import require_roles
from app.domains.auth.models import User,UserRole
from app.domains.marketplace_comms.models import Message,Quote
from app.domains.marketplace_comms.schemas import MessageCreate,QuoteCreate
from app.domains.marketplace_comms.service import MarketplaceCommsService
router=APIRouter()
Db=Annotated[AsyncSession,Depends(get_db)]
@router.post("/lead-connections/{connection_id}/quotes")
async def quote(connection_id:uuid.UUID,payload:QuoteCreate,user:Annotated[User,Depends(require_roles(UserRole.vendor_admin))],db:Db):
 s=MarketplaceCommsService(db)
 try:c=await s.provider_connection(connection_id,user);q=await s.create_quote(c,payload);return {"id":str(q.id),"version":q.version,"status":q.status.value,"currency":q.currency,"total_amount":str(q.total_amount)}
 except LookupError as e:raise HTTPException(404,str(e))
@router.get("/lead-connections/{connection_id}/quotes")
async def quotes(connection_id:uuid.UUID,user:Annotated[User,Depends(require_roles(UserRole.customer))],db:Db):
 s=MarketplaceCommsService(db)
 try:c=await s.customer_connection(connection_id,user.id);items=list((await db.scalars(select(Quote).where(Quote.lead_connection_id==c.id).order_by(Quote.version.desc()))).all());return [{"id":str(q.id),"version":q.version,"status":q.status.value,"currency":q.currency,"total_amount":str(q.total_amount),"line_items":q.line_items,"terms":q.terms} for q in items]
 except LookupError as e:raise HTTPException(404,str(e))
@router.post("/lead-connections/{connection_id}/messages")
async def send_message(connection_id:uuid.UUID,payload:MessageCreate,user:Annotated[User,Depends(require_roles(UserRole.customer,UserRole.vendor_admin))],db:Db):
 s=MarketplaceCommsService(db)
 try:
  c=await (s.customer_connection(connection_id,user.id) if user.role==UserRole.customer else s.provider_connection(connection_id,user));m=await s.message(c,user.id,payload);return {"id":str(m.id),"conversation_id":str(m.conversation_id),"body":m.body}
 except LookupError as e:raise HTTPException(404,str(e))
@router.get("/lead-connections/{connection_id}/messages")
async def messages(connection_id:uuid.UUID,user:Annotated[User,Depends(require_roles(UserRole.customer,UserRole.vendor_admin))],db:Db):
 s=MarketplaceCommsService(db)
 try:
  c=await (s.customer_connection(connection_id,user.id) if user.role==UserRole.customer else s.provider_connection(connection_id,user));conv=await s.conversation(c);items=list((await db.scalars(select(Message).where(Message.conversation_id==conv.id).order_by(Message.created_at))).all());return [{"id":str(m.id),"sender_user_id":str(m.sender_user_id),"body":m.body,"created_at":m.created_at} for m in items]
 except LookupError as e:raise HTTPException(404,str(e))
