from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.db import crud_chats
from app.models.chat_schemas import ChatSessionCreate, ChatSessionOut, ChatSessionDetailOut, ChatMessageOut
from app.routes._dev_auth_dependency import get_current_user_id

router = APIRouter(prefix="/chats", tags=["chats"])


# ---- TEMP auth dependency (replace with JWT later) ----
# def get_current_user_id() -> str:
#     """
#     Replace this with real auth (JWT) soon.
#     For now, hardcode or wire from headers in a dependency.
#     """
#     raise HTTPException(status_code=501, detail="Auth not implemented. Add JWT and return user_id.")


@router.post("", response_model=ChatSessionOut)
def create_chat(
    payload: ChatSessionCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        s = crud_chats.create_chat_session(
            db,
            user_id=user_id,
            course_id=payload.course_id,
            title=payload.title,
        )
        return s
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.get("", response_model=list[ChatSessionOut])
def list_chats(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    include_archived: bool = Query(default=False),
):
    return crud_chats.list_chat_sessions(db, user_id=user_id, include_archived=include_archived)


@router.get("/{session_id}", response_model=ChatSessionDetailOut)
def get_chat_with_messages(
    session_id: UUID,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    limit: int = Query(default=200, ge=1, le=2000),
):
    s = crud_chats.get_chat_session(db, user_id=user_id, session_id=session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Chat session not found")

    msgs = crud_chats.list_messages(db, user_id=user_id, session_id=session_id, limit=limit)
    return {
        "session": s,
        "messages": msgs,
    }


@router.patch("/{session_id}/title", response_model=ChatSessionOut)
def rename_chat(
    session_id: UUID,
    title: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        return crud_chats.rename_chat_session(db, user_id=user_id, session_id=session_id, title=title)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{session_id}/archive", response_model=ChatSessionOut)
def archive_chat(
    session_id: UUID,
    is_archived: bool,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        return crud_chats.set_chat_archived(db, user_id=user_id, session_id=session_id, is_archived=is_archived)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{session_id}")
def delete_chat(
    session_id: UUID,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        crud_chats.delete_chat_session(db, user_id=user_id, session_id=session_id)
        return {"deleted": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
