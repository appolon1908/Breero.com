import uuid
from pydantic import BaseModel, Field, ConfigDict
from .models import ProjectRequestStatus

class AnswerInput(BaseModel):
    question_id: uuid.UUID
    value: dict
class ProjectRequestCreate(BaseModel):
    service_id: uuid.UUID
    address_id: uuid.UUID|None=None
    title: str=Field(min_length=3,max_length=160)
    description: str|None=Field(default=None,max_length=5000)
    answers: list[AnswerInput]=Field(default_factory=list)
class ProjectRequestPatch(BaseModel):
    address_id: uuid.UUID|None=None
    title: str|None=Field(default=None,min_length=3,max_length=160)
    description: str|None=Field(default=None,max_length=5000)
    answers: list[AnswerInput]|None=None
class ProjectRequestRead(BaseModel):
    model_config=ConfigDict(from_attributes=True)
    id: uuid.UUID; customer_id: uuid.UUID; service_id: uuid.UUID; address_id: uuid.UUID|None
    title: str; description: str|None; status: ProjectRequestStatus; version: int
