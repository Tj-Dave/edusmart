from typing import Any

from pydantic import BaseModel, Field
from uuid import UUID

class QueryRequest(BaseModel):
    session_id: UUID
    query: str
    retrieval_mode: str | None = None


class QueryResponse(BaseModel):
    query: str
    bloom_level: str
    prompt: str
    response: str
    course_id: str
    citations: list[dict[str, Any]] = Field(default_factory=list)
    message_id: int | None = None
    dev_trace: dict[str, Any] | None = None
    retrieval_mode: str | None = None

class IngestResponse(BaseModel):
    query: str
