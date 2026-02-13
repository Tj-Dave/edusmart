# app/db/crud_chats.py
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import ChatSession, ChatMessage, MessageRole, MemoryState


def create_chat_session(db: Session, user_id, course_id: str, title: Optional[str] = None) -> ChatSession:
    session = ChatSession(user_id=user_id, course_id=course_id, title=title, is_archived=False)
    db.add(session)
    db.commit()
    db.refresh(session)

    # Create memory state row so summarization has a place to track progress
    ms = MemoryState(session_id=session.id, last_summarized_message_id=0)
    db.add(ms)
    db.commit()

    return session


def list_chat_sessions(db: Session, user_id, include_archived: bool = False) -> List[ChatSession]:
    q = db.query(ChatSession).filter(ChatSession.user_id == user_id)
    if not include_archived:
        q = q.filter(ChatSession.is_archived == False)  # noqa: E712
    return q.order_by(ChatSession.updated_at.desc()).all()


def get_chat_session(db: Session, user_id, session_id: UUID) -> Optional[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user_id)
        .one_or_none()
    )

def get_session_course_id(db: Session, user_id, session_id: UUID) -> str:
    s = get_chat_session(db, user_id, session_id)
    if not s:
        raise ValueError("Chat session not found")
    return s.course_id



def rename_chat_session(db: Session, user_id, session_id: UUID, title: str) -> ChatSession:
    s = get_chat_session(db, user_id, session_id)
    if not s:
        raise ValueError("Chat session not found")
    s.title = title
    db.commit()
    db.refresh(s)
    return s


def set_chat_archived(db: Session, user_id, session_id: UUID, is_archived: bool) -> ChatSession:
    s = get_chat_session(db, user_id, session_id)
    if not s:
        raise ValueError("Chat session not found")
    s.is_archived = is_archived
    db.commit()
    db.refresh(s)
    return s


def delete_chat_session(db: Session, user_id, session_id: UUID) -> None:
    s = get_chat_session(db, user_id, session_id)
    if not s:
        raise ValueError("Chat session not found")
    db.delete(s)  # cascades to messages + memory_state
    db.commit()


def list_messages(db: Session, user_id, session_id: UUID, limit: int = 200) -> List[ChatMessage]:
    s = get_chat_session(db, user_id, session_id)
    if not s:
        raise ValueError("Chat session not found")

    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id, ChatMessage.user_id == user_id)
        .order_by(ChatMessage.id.asc())
        .limit(limit)
        .all()
    )


def append_message(db: Session, user_id, session_id: UUID, role: MessageRole, content: str) -> ChatMessage:
    s = get_chat_session(db, user_id, session_id)
    if not s:
        raise ValueError("Chat session not found")

    msg = ChatMessage(
        session_id=session_id,
        user_id=user_id,
        role=role,
        content=content,
    )
    db.add(msg)

    # touch session updated_at (db trigger also does this if you added it)
    # but setting it here also works even without triggers
    # s.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(msg)
    return msg
