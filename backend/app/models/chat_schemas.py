from __future__ import annotations

from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field


class ChatSessionCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    course_id: str


class ChatSessionOut(BaseModel):
    id: UUID
    title: Optional[str]
    course_id: str
    is_archived: bool

    class Config:
        from_attributes = True


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str

    class Config:
        from_attributes = True


class ChatSessionDetailOut(BaseModel):
    session: ChatSessionOut
    messages: List[ChatMessageOut]
