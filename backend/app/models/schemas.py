from pydantic import BaseModel
from uuid import UUID

class QueryRequest(BaseModel):
    session_id: UUID
    query: str


class QueryResponse(BaseModel):
    query: str
    bloom_level: str
    prompt: str
    response: str
    course_id: str

class IngestResponse(BaseModel):
    query: str