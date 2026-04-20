from __future__ import annotations

import json
import re
from fastapi.concurrency import run_in_threadpool


from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Form, Request
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.db import crud_chats
from app.models.chat_schemas import (
    ChatSessionCreate,
    ChatSessionOut,
    ChatSessionDetailOut,
    ChatQueryIn,
    ChatQueryOut,
)
from app.services.auth.deps import get_current_user
from app.db.models import User

# reuse your AI pipeline function
from app.routes.ai_query import run_ai_pipeline

#   =================================
#   Helper Functions
#   =================================
def _clean_title(s: str, max_len: int = 45) -> str:
    s = (s or "").strip()

    # remove surrounding quotes/backticks
    s = s.strip("`").strip().strip('"').strip("'").strip()

    # collapse whitespace
    s = " ".join(s.split())

    # remove trailing punctuation
    s = re.sub(r"[.!,;:\-–—\s]+$", "", s).strip()

    # enforce 3–5 words by trimming
    words = s.split()
    if len(words) > 5:
        s = " ".join(words[:5])
    elif len(words) < 3:
        # too short: let caller fallback
        return ""

    # hard clamp length
    if len(s) > max_len:
        s = s[:max_len].rstrip()

    return s


def _try_extract_json_title(raw: str) -> Optional[str]:
    if not raw:
        return None

    text = raw.strip()

    # Remove markdown fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)

    # 1) Whole JSON
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and isinstance(obj.get("title"), str):
            t = obj["title"].strip()
            if _is_valid_title_candidate(t):
                return t
    except Exception:
        pass

    # 2) Embedded JSON (first valid object)
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if m:
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict) and isinstance(obj.get("title"), str):
                t = obj["title"].strip()
                if _is_valid_title_candidate(t):
                    return t
        except Exception:
            pass

    # 3) Plain line fallback BUT validate
    first_line = text.splitlines()[0].strip()
    if first_line and "{" not in first_line and "}" not in first_line:
        if _is_valid_title_candidate(first_line):
            return first_line

    return None


def _is_valid_title_candidate(s: str) -> bool:
    s = (s or "").strip()
    if len(s) < 6:
        return False
    # reject trivial punctuation like "." or "..."
    if re.fullmatch(r"[^\w]+", s):
        return False
    # must contain at least 2 letters
    if len(re.findall(r"[A-Za-z]", s)) < 2:
        return False
    return True


async def _generate_phi_title(req: Request, text: str) -> str:
    """
    Uses your app.state.llm_client (Phi-3-mini) to generate a short chat title.
    Falls back safely if the model output is invalid.
    """
    llm_client = getattr(req.app.state, "llm_subclient", None)
    if llm_client is None:
        return _fallback_title_from_text(text)

    prompt = f"""### Instruction:
Generate a short chat title (3-5 words) summarizing this user query. Output ONLY valid JSON with a single "title" field.

Query: {text.strip()}

### Response (JSON only):
{{"title":"""

    try:
        raw = await run_in_threadpool(llm_client.generate, prompt, False)
        extracted = _try_extract_json_title(raw)
        cleaned = _clean_title(extracted or "")
        if cleaned:
            return cleaned
        return _fallback_title_from_text(text)
    except Exception:
        return _fallback_title_from_text(text)


def _fallback_title_from_text(text: str, max_len: int = 40) -> str:
    t = " ".join((text or "").split()).strip()
    if not t:
        return "Chat"
    return (t[:max_len].rstrip() + "…") if len(t) > max_len else t


def _extract_latest_assistant_message_id(messages: list) -> Optional[int]:
    """
    Tries to find the most recent assistant message id from a list of ChatMessage ORM objects.
    Works even if list_messages ordering changes, by taking max(id) among assistant messages.
    """
    best: Optional[int] = None
    for m in messages or []:
        role = getattr(m, "role", None)
        mid = getattr(m, "id", None)
        if role is None or mid is None:
            continue
        # role could be enum MessageRole.assistant or "assistant"
        role_str = str(role).lower()
        if "assistant" in role_str:
            if best is None or int(mid) > best:
                best = int(mid)
    return best


router = APIRouter(prefix="/chats", tags=["chats"])


@router.post("", response_model=ChatSessionOut)
def create_chat(
    payload: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    course_code = (payload.course_code or "").strip() or None

    try:
        s = crud_chats.create_chat_session(
            db,
            user_id=str(current_user.id),
            course_id=course_code,   # stored in DB as course_id
            title=payload.title,
            auto_create_course=False,
        )
        return s
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[ChatSessionOut])
def list_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    include_archived: bool = Query(default=False),
    course_id: str | None = Query(default=None),
    general_only: bool = Query(default=False),
):
    return crud_chats.list_chat_sessions(
        db,
        user_id=str(current_user.id),
        include_archived=include_archived,
        course_id=course_id,
        general_only=general_only,
    )


@router.get("/{session_id}", response_model=ChatSessionDetailOut)
def get_chat_with_messages(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=200, ge=1, le=2000),
):
    s = crud_chats.get_chat_session(db, user_id=str(current_user.id), session_id=session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Chat session not found")

    msgs = crud_chats.list_messages(db, user_id=str(current_user.id), session_id=session_id, limit=limit)
    return {"session": s, "messages": msgs}


@router.post("/{session_id}/messages")
async def send_message(
    session_id: UUID,
    content: str = Form(...),
    req: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not content or not content.strip():
        raise HTTPException(status_code=422, detail="content is required")

    return await run_ai_pipeline(
        user_query=content.strip(),
        req=req,
        db=db,
        user_id=str(current_user.id),
        session_id=session_id,
    )

# =========================
# ✅ NEW: Atomic chat query
# POST /chats/query
# =========================
@router.delete("/{session_id}")
def delete_chat(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        crud_chats.delete_chat_session(db, user_id=str(current_user.id), session_id=session_id)
        return {"message": "Chat session deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{session_id}/archive")
def archive_chat(
    session_id: UUID,
    is_archived: bool = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        s = crud_chats.set_chat_archived(db, user_id=str(current_user.id), session_id=session_id, is_archived=is_archived)
        return s
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/query", response_model=ChatQueryOut)
async def chat_query_atomic(
    payload: ChatQueryIn,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = (payload.content or "").strip()
    if not content:
        raise HTTPException(status_code=422, detail="content is required")

    course_code = (payload.course_code or "").strip() or None
    limit = payload.limit

    # ✅ Phi title generation BEFORE session creation
    title = await _generate_phi_title(req, content)

    try:
        # 1) Create session with Phi-generated title
        created_session = crud_chats.create_chat_session(
            db,
            user_id=str(current_user.id),
            course_id=course_code,
            title=title,
        )

        # 2) Run your existing pipeline (stores user msg + assistant msg)
        pipeline_result = await run_ai_pipeline(
            user_query=content,
            req=req,
            db=db,
            user_id=str(current_user.id),
            session_id=created_session.id,
        )

        # 3) Load session + messages from DB (UI hydration)
        s = crud_chats.get_chat_session(db, user_id=str(current_user.id), session_id=created_session.id)
        if not s:
            raise HTTPException(status_code=500, detail="Failed to load created chat session")

        msgs = crud_chats.list_messages(
            db,
            user_id=str(current_user.id),
            session_id=created_session.id,
            limit=limit,
        )

        assistant_message_id = getattr(pipeline_result, "message_id", None) or _extract_latest_assistant_message_id(msgs)

        return {
            "session": s,
            "messages": msgs,
            "response": getattr(pipeline_result, "response", "") or "",
            "citations": getattr(pipeline_result, "citations", []) or [],
            "message_id": assistant_message_id,
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
