# app/db/crud_chats.py
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import ChatSession, ChatMessage, MessageRole, MemoryState, Course


def _normalize_course_code(course_id: Optional[str]) -> Optional[str]:
    """
    Normalizes course codes like ' swe3101 ' -> 'SWE3101'.
    Returns None if empty.
    """
    if course_id is None:
        return None
    code = course_id.strip().upper()
    return code or None


def _ensure_course_exists(
    db: Session,
    course_code: str,
    *,
    auto_create: bool = True,
) -> None:
    """
    Ensures course_code exists in courses table.
    - If auto_create=True: creates a placeholder course if missing.
    - If auto_create=False: raises ValueError if missing.
    """
    existing = (
        db.query(Course)
        .filter(Course.course_code == course_code)
        .one_or_none()
    )

    if existing:
        return

    if not auto_create:
        raise ValueError(f"Course '{course_code}' not found")

    # Create placeholder course row
    placeholder = Course(
        course_code=course_code,
        course_name=course_code,   # minimal placeholder; update later via admin UI
        description=None,
        department=None,
        faculty=None,
        level=None,
        credits=None,
        is_active=True,
    )
    db.add(placeholder)
    # flush so FK inserts after this in same txn are safe
    db.flush()


def create_chat_session(
    db: Session,
    user_id: str,
    course_id: Optional[str],
    title: Optional[str] = None,
    *,
    auto_create_course: bool = True,
) -> ChatSession:
    """
    Creates a chat session and its memory_state.

    With FK: chat_sessions.course_id -> courses.course_code
    - If course_id is provided, we validate it exists (or auto-create placeholder).
    - If course_id is None, this becomes a "General chat" session.
    """
    course_code = _normalize_course_code(course_id)

    # Single transaction
    try:
        if course_code:
            _ensure_course_exists(db, course_code, auto_create=auto_create_course)

        session = ChatSession(
            user_id=user_id,
            course_id=course_code,  # may be None
            title=title,
            is_archived=False,
        )
        db.add(session)
        db.flush()  # get session.id without committing yet

        ms = MemoryState(session_id=session.id, last_summarized_message_id=0)
        db.add(ms)

        db.commit()
        db.refresh(session)
        return session
    except Exception:
        db.rollback()
        raise


def list_chat_sessions(
    db: Session,
    user_id: str,
    include_archived: bool = False,
    course_id: Optional[str] = None,
    general_only: bool = False,
) -> List[ChatSession]:
    q = db.query(ChatSession).filter(ChatSession.user_id == user_id)

    # ✅ general-only overrides course filter
    if general_only:
        q = q.filter(ChatSession.course_id.is_(None))
    else:
        course_code = _normalize_course_code(course_id)
        if course_code is not None:
            q = q.filter(ChatSession.course_id == course_code)

    if not include_archived:
        q = q.filter(ChatSession.is_archived == False)  # noqa: E712

    return q.order_by(ChatSession.updated_at.desc()).all()


def get_chat_session(db: Session, user_id: str, session_id: UUID) -> Optional[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user_id)
        .one_or_none()
    )


def get_session_course_id(db: Session, user_id: str, session_id: UUID) -> Optional[str]:
    s = get_chat_session(db, user_id, session_id)
    if not s:
        raise ValueError("Chat session not found")
    return s.course_id


def rename_chat_session(db: Session, user_id: str, session_id: UUID, title: str) -> ChatSession:
    s = get_chat_session(db, user_id, session_id)
    if not s:
        raise ValueError("Chat session not found")
    s.title = title
    db.commit()
    db.refresh(s)
    return s


def set_chat_archived(db: Session, user_id: str, session_id: UUID, is_archived: bool) -> ChatSession:
    s = get_chat_session(db, user_id, session_id)
    if not s:
        raise ValueError("Chat session not found")
    s.is_archived = is_archived
    db.commit()
    db.refresh(s)
    return s


def delete_chat_session(db: Session, user_id: str, session_id: UUID) -> None:
    s = get_chat_session(db, user_id, session_id)
    if not s:
        raise ValueError("Chat session not found")
    db.delete(s)  # cascades to messages + memory_state
    db.commit()


def list_messages(db: Session, user_id: str, session_id: UUID, limit: int = 200) -> List[ChatMessage]:
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


def append_message(db: Session, user_id: str, session_id: UUID, role: MessageRole, content: str) -> ChatMessage:
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

    db.commit()
    db.refresh(msg)
    return msg
