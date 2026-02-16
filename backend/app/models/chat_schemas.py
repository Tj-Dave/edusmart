from __future__ import annotations

from typing import Any, Optional, List, Dict
from uuid import UUID
from pydantic import BaseModel, Field

class ChatQueryIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=8000)
    course_code: Optional[str] = None
    limit: int = Field(default=200, ge=1, le=2000)  # for memory/context usage if needed

class ChatQueryOut(BaseModel):
    session: ChatSessionOut
    messages: List[ChatMessageOut]
    response: str
    citations: List[Dict[str, Any]] = []
    message_id: Optional[int] = None  # assistant message id

class ChatSessionCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    course_code: Optional[str] = None

class ChatSessionOut(BaseModel):
    id: UUID
    title: Optional[str]
    course_id: Optional[str]
    is_archived: bool
    created_at: Any
    message_count: int = 0

    class Config:
        from_attributes = True

class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: Any

    class Config:
        from_attributes = True

class ChatSessionDetailOut(BaseModel):
    session: ChatSessionOut
    messages: List[ChatMessageOut]
