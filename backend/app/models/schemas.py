from typing import Any

from pydantic import BaseModel, Field
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
    citations: list[dict[str, Any]] = Field(default_factory=list)
    message_id: int | None = None

class IngestResponse(BaseModel):
    query: str
