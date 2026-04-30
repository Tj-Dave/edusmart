from uuid import UUID
import time

from fastapi import APIRouter, HTTPException, Request, Depends, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.models.schemas import QueryRequest, QueryResponse
from app.services.prompt_engine import PromptEngine
from app.services.intelligent_confidence_layer import IntelligentConfidenceLayer
from app.services.logging.pipeline_logger import StageTimer

from app.db.postgres import get_db
from app.db import crud_chats
from app.db.models import MessageRole, User
from app.services.auth.deps import get_current_user

router = APIRouter(prefix="/ai-query", tags=["ai"])


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


# Confidence thresholds for gating pipeline components
BLOOM_THRESHOLD = 0.4
CBC_THRESHOLD = 0.5
RAG_THRESHOLD = 0.6


async def run_ai_pipeline(
    *,
    user_query: str,
    req: Request,
    db: Session,
    user_id: str,
    session_id: UUID,
) -> QueryResponse:
    # Initialize components
    bloom_detector = req.app.state.bloom_detector
    competency_mapper = req.app.state.competency_mapper
    rag_engine = req.app.state.rag_engine
    llm_client = req.app.state.llm_client
    llm_subclient= req.app.state.llm_subclient
    memory_manager = getattr(req.app.state, "memory_manager", None)
    pipeline_logger = getattr(req.app.state, "pipeline_logger", None)

    # Generate trace ID for request tracking
    trace_id = pipeline_logger.generate_trace_id() if pipeline_logger else None
    pipeline_start = time.perf_counter()

    # 0) session must exist + belong to user; fetch course_id (server-trusted)
    try:
        course_id = crud_chats.get_session_course_id(db, user_id=user_id, session_id=session_id)
        if course_id is None:
            course_id = ""  # fallback to empty course context if not found
    except ValueError as e:
        if pipeline_logger:
            pipeline_logger.log_error(
                trace_id=trace_id,
                stage="session_validation",
                error=str(e),
                error_type="ValueError",
            )
        raise HTTPException(status_code=404, detail=str(e))

    # Log input stage
    if pipeline_logger:
        pipeline_logger.log_input(
            query=user_query,
            user_id=user_id,
            session_id=session_id,
            course_id=course_id,
            trace_id=trace_id,
        )

    # 1) store user message
    try:
        crud_chats.append_message(
            db,
            user_id=user_id,
            session_id=session_id,
            role=MessageRole.user,
            content=user_query,
        )
    except ValueError as e:
        if pipeline_logger:
            pipeline_logger.log_error(
                trace_id=trace_id,
                stage="store_user_message",
                error=str(e),
                error_type="ValueError",
            )
        raise HTTPException(status_code=404, detail=str(e))

    # 2) Intelligent Confidence Layer - compute confidence scores
    with StageTimer() as icl_timer:
        icl = IntelligentConfidenceLayer(llm_subclient)
        confidence_scores = await icl.compute(user_query)
    
    # Log confidence scores
    if pipeline_logger:
        pipeline_logger.log_confidence_scores(
            trace_id=trace_id,
            scores=confidence_scores,
            latency_ms=icl_timer.latency_ms,
        )

    # 3) memory block (optional)
    memory_block = ""
    if memory_manager is not None:
        ctx_pack = memory_manager.build_context_pack(db, user_id, session_id, user_query)
        memory_block = _format_memory_block(ctx_pack)

    # 4) bloom detection (gated by confidence)
    with StageTimer() as bloom_timer:
        if confidence_scores["bloom_conf"] > BLOOM_THRESHOLD:
            bloom_level = bloom_detector.detect(user_query)
            bloom_gated = False
        else:
            bloom_level = "No Bloom level detection"  # default bloom level
            bloom_gated = True
    
    # Log bloom detection
    if pipeline_logger:
        pipeline_logger.log_bloom_detection(
            trace_id=trace_id,
            query=user_query,
            bloom_level=bloom_level,
            gated=bloom_gated,
            latency_ms=bloom_timer.latency_ms,
        )

    # 5) competency mapping (gated by confidence)
    with StageTimer() as cbc_timer:
        if confidence_scores["cbc_conf"] > CBC_THRESHOLD:
            competency = competency_mapper.map(user_query)
            cbc_gated = False
        else:
            competency = None  # skip competency mapping
            cbc_gated = True
    
    # Log competency mapping
    if pipeline_logger:
        pipeline_logger.log_competency_mapping(
            trace_id=trace_id,
            query=user_query,
            competency=competency,
            gated=cbc_gated,
            latency_ms=cbc_timer.latency_ms,
        )

    # 6) rag retrieve (gated by confidence, course-scoped)
    with StageTimer() as rag_timer:
        if confidence_scores["rag_conf"] > RAG_THRESHOLD:
            retrieved_context = rag_engine.retrieve_bundle(user_query, course_id=course_id)
            context_chunks = [row.get("context", "") for row in retrieved_context]
            citations = [row.get("citation", {}) for row in retrieved_context if row.get("citation")]
            rag_gated = False
        else:
            retrieved_context = []
            context_chunks = []
            citations = []
            rag_gated = True
    
    # Log RAG retrieval
    if pipeline_logger:
        pipeline_logger.log_rag_retrieval(
            trace_id=trace_id,
            query=user_query,
            course_id=course_id,
            chunks=retrieved_context,
            gated=rag_gated,
            latency_ms=rag_timer.latency_ms,
        )

    # 7) build prompt
    final_prompt = PromptEngine.build_prompt(
        query=user_query,
        bloom_level=bloom_level,
        competency=competency,
        context=context_chunks,
        memory=memory_block,
    )
    
    # Log prompt construction
    if pipeline_logger:
        pipeline_logger.log_prompt_construction(
            trace_id=trace_id,
            query=user_query,
            bloom_level=bloom_level,
            competency=competency,
            num_context_chunks=len(context_chunks),
            has_memory=bool(memory_block),
            final_prompt=final_prompt,
        )

    # 8) generate
    with StageTimer() as llm_timer:
        response_text = await run_in_threadpool(llm_client.generate, final_prompt)
    
    # Log LLM generation
    if pipeline_logger:
        pipeline_logger.log_llm_generation(
            trace_id=trace_id,
            response=response_text,
            token_count=None,  # llama.cpp doesn't expose token count easily
            latency_ms=llm_timer.latency_ms,
        )

    # 9) store assistant message
    assistant_message = crud_chats.append_message(
        db,
        user_id=user_id,
        session_id=session_id,
        role=MessageRole.assistant,
        content=response_text,
    )

    # 10) summarize memory (optional)
    if memory_manager is not None:
        memory_manager.maybe_summarize(db, user_id, session_id)

    # Calculate total pipeline latency
    pipeline_end = time.perf_counter()
    total_latency_ms = (pipeline_end - pipeline_start) * 1000
    
    # Log final response
    if pipeline_logger:
        pipeline_logger.log_final_response(
            trace_id=trace_id,
            message_id=int(assistant_message.id) if getattr(assistant_message, "id", None) is not None else None,
            query=user_query,
            response=response_text,
            bloom_level=bloom_level,
            course_id=course_id,
            num_citations=len(citations),
            total_latency_ms=total_latency_ms,
        )

    return QueryResponse(
        query=user_query,
        bloom_level=bloom_level,
        prompt=final_prompt,
        response=response_text,
        course_id=course_id,
        citations=citations,
        message_id=int(assistant_message.id) if getattr(assistant_message, "id", None) is not None else None,
    )


@router.post("/ai-query", response_model=QueryResponse)
async def ai_query(
    request: QueryRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = str(current_user.id)
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
    current_user: User = Depends(get_current_user),
):
    user_id = str(current_user.id)
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
