from pydantic import BaseModel
from uuid import UUID
from typing import List, Dict

class QueryRequest(BaseModel):
    session_id: UUID
    query: str


class QueryResponse(BaseModel):
    query: str
    bloom_level: str
    prompt: str
    response: str

class IngestResponse(BaseModel):
    query: str