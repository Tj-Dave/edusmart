from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Depends, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.models.schemas import QueryRequest, QueryResponse
from app.services.prompt_engine import PromptEngine

from app.db.postgres import get_db
from app.db import crud_chats
from app.db.models import MessageRole
from app.routes._dev_auth_dependency import get_current_user_id  # uses X-User-Id header (dev)

router = APIRouter()


def _format_memory_block(ctx_pack: dict) -> str:
    recent = ctx_pack.get("recent_messages", [])
    memories = ctx_pack.get("relevant_memories", [])

    lines = []

    if recent:
        lines.append("Recent conversation:")
        for m in recent:
            role = m.get("role", "user")
            content = (m.get("content") or "").strip()
            if content:
                lines.append(f"{role}: {content}")

    if memories:
        lines.append("\nRelevant long-term memory:")
        for item in memories:
            text = (item.get("text") or "").strip()
            if text:
                lines.append(f"- {text}")

    return "\n".join(lines).strip()


async def run_ai_pipeline(
    user_query: str,
    req: Request,
    db: Session,
    user_id: str,
    session_id: UUID,
):
    bloom_detector = req.app.state.bloom_detector
    competency_mapper = req.app.state.competency_mapper
    rag_engine = req.app.state.rag_engine
    llm_client = req.app.state.llm_client
    memory_manager = getattr(req.app.state, "memory_manager", None)

    # 0) Store user message in Postgres chat_messages
    try:
        crud_chats.append_message(
            db,
            user_id=user_id,
            session_id=session_id,
            role=MessageRole.user,
            content=user_query,
        )
    except ValueError as e:
        # chat session doesn't exist or doesn't belong to user
        raise HTTPException(status_code=404, detail=str(e))

    # 0.1) Memory (optional): keep your existing MemoryManager if it's available
    memory_block = ""
    if memory_manager is not None:
        ctx_pack = memory_manager.build_context_pack(db, user_id, session_id, user_query)
        memory_block = _format_memory_block(ctx_pack)

    # 1) Bloom
    bloom_level = bloom_detector.detect(user_query)

    # 2) Competency mapping
    competency = competency_mapper.map(user_query)

    # 3) RAG retrieve
    context_chunks = rag_engine.retrieve(user_query)

    # 4) Build prompt (includes memory)
    final_prompt = PromptEngine.build_prompt(
        query=user_query,
        bloom_level=bloom_level,
        competency=competency,
        context=context_chunks,
        memory=memory_block,
    )

    # 5) Generate answer
    response_text = await run_in_threadpool(llm_client.generate, final_prompt)

    # 6) Store assistant message in Postgres chat_messages
    crud_chats.append_message(
        db,
        user_id=user_id,
        session_id=session_id,
        role=MessageRole.assistant,
        content=response_text,
    )

    # 6.1) Store assistant in MemoryManager too (optional)
    if memory_manager is not None:
        memory_manager.maybe_summarize(db, user_id, session_id)

    return QueryResponse(
        query=user_query,
        bloom_level=bloom_level,
        prompt=final_prompt,
        response=response_text,
    )


@router.post("/ai-query", response_model=QueryResponse)
async def ai_query(
    request: QueryRequest,
    req: Request,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        return await run_ai_pipeline(
            user_query=request.query,
            req=req,
            db=db,
            user_id=user_id,
            session_id=request.session_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-query", response_model=QueryResponse)
async def ai_query_browser(
    query: str,
    session_id: UUID = Query(...),
    req: Request = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        return await run_ai_pipeline(
            user_query=query,
            req=req,
            db=db,
            user_id=user_id,
            session_id=session_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
