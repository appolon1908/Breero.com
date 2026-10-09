import uuid
from decimal import Decimal
from pydantic import BaseModel,Field
class QuoteCreate(BaseModel):
 currency:str=Field(min_length=3,max_length=3);line_items:list[dict];total_amount:Decimal=Field(gt=0);terms:str|None=Field(default=None,max_length=5000)
class MessageCreate(BaseModel):
 body:str=Field(min_length=1,max_length=10000);client_message_id:str=Field(min_length=8,max_length=128)
