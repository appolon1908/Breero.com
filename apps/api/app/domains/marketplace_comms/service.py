import uuid
from sqlalchemy import func,select
from sqlalchemy.ext.asyncio import AsyncSession
from app.domains.booking.models import Customer
from app.domains.marketplace.models import LeadConnection
from app.domains.project_requests.models import ProjectRequest
from app.domains.workforce.provider_scope import provider_vendor
from .models import Conversation,Message,Quote,QuoteStatus
from .schemas import MessageCreate,QuoteCreate
class MarketplaceCommsService:
 def __init__(self,session:AsyncSession):self.session=session
 async def customer_connection(self,connection_id:uuid.UUID,user_id:uuid.UUID)->LeadConnection:
  customer=await self.session.scalar(select(Customer).where(Customer.user_id==user_id))
  if not customer:raise PermissionError("Customer profile required")
  c=await self.session.scalar(select(LeadConnection).join(ProjectRequest).where(LeadConnection.id==connection_id,ProjectRequest.customer_id==customer.id,LeadConnection.active.is_(True)))
  if not c:raise LookupError("Connection not found")
  return c
 async def provider_connection(self,connection_id,user):
  vendor=await provider_vendor(self.session,user);c=await self.session.scalar(select(LeadConnection).where(LeadConnection.id==connection_id,LeadConnection.vendor_id==vendor.id,LeadConnection.active.is_(True)))
  if not c:raise LookupError("Connection not found")
  return c
 async def create_quote(self,c:LeadConnection,p:QuoteCreate)->Quote:
  latest=await self.session.scalar(select(func.max(Quote.version)).where(Quote.lead_connection_id==c.id));q=Quote(lead_connection_id=c.id,vendor_id=c.vendor_id,version=(latest or 0)+1,status=QuoteStatus.SENT,currency=p.currency.upper(),total_amount=p.total_amount,line_items=p.line_items,terms=p.terms);self.session.add(q);await self.session.commit();await self.session.refresh(q);return q
 async def conversation(self,c:LeadConnection)->Conversation:
  item=await self.session.scalar(select(Conversation).where(Conversation.lead_connection_id==c.id))
  if not item:item=Conversation(lead_connection_id=c.id);self.session.add(item);await self.session.commit();await self.session.refresh(item)
  return item
 async def message(self,c:LeadConnection,user_id:uuid.UUID,p:MessageCreate)->Message:
  conv=await self.conversation(c);existing=await self.session.scalar(select(Message).where(Message.conversation_id==conv.id,Message.client_message_id==p.client_message_id))
  if existing:return existing
  m=Message(conversation_id=conv.id,sender_user_id=user_id,body=p.body,client_message_id=p.client_message_id,metadata_json={});self.session.add(m);await self.session.commit();await self.session.refresh(m);return m
