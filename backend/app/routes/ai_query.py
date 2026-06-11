from uuid import UUID
import asyncio
import time
import json
import re
from typing import Any, AsyncGenerator, Optional

from fastapi import APIRouter, HTTPException, Request, Depends, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from app.models.schemas import QueryRequest, QueryResponse
from app.services.prompt_engine import PromptEngine
from app.services.intelligent_confidence_layer import IntelligentConfidenceLayer
from app.services.logging.pipeline_logger import StageTimer

from app.db.postgres import get_db
from app.db import crud_chats
from app.db.models import CourseOffering, Enrollment, MessageRole, User
from app.services.auth.deps import get_current_user
from app.core.config import settings
from app.services.harag.grounding_checker import EvidenceGroundingChecker
from app.services.harag.storage_service import HARAGStorageService

router = APIRouter(prefix="/ai-query", tags=["ai"])


class AIQueryStreamRequest(BaseModel):
    """Request model for unified streaming endpoint."""
    message: str
    course_id: Optional[str] = None
    topic_id: Optional[str] = None
    session_id: Optional[str] = None
    attachments: Optional[list] = None
    retrieval_mode: Optional[str] = None


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
RAG_THRESHOLD = 0.2
MAX_WORDS_PER_STREAM_EVENT = 3


def _dev_mode_enabled(req: Request) -> bool:
    if not settings.APP_DEBUG:
        return False
    header = (req.headers.get("x-edusmart-dev-mode") or req.headers.get("x-dev-mode") or "").lower()
    query = (req.query_params.get("dev_mode") or "").lower()
    return header in {"1", "true", "yes", "on"} or query in {"1", "true", "yes", "on"}


def _normalize_retrieval_mode(value: Optional[str], *, harag_available: bool) -> str:
    requested = (value or "").strip().lower()
    if requested in {"standard", "legacy", "simple"}:
        return "standard"
    if requested in {"harag", "ha-rag", "ha_rag", "hierarchical"}:
        return "harag" if harag_available else "standard"
    return "harag" if harag_available else "standard"


def _resolve_retrieval_mode(req: Request, payload_mode: Optional[str], *, harag_available: bool) -> str:
    header_mode = req.headers.get("x-edusmart-retrieval-mode") or req.headers.get("x-retrieval-mode")
    query_mode = req.query_params.get("retrieval_mode")
    return _normalize_retrieval_mode(payload_mode or header_mode or query_mode, harag_available=harag_available)


def _standard_rag_dev_trace(
    *,
    retrieved_context: list[dict[str, Any]],
    course_id: str,
    rag_gated: bool,
) -> dict[str, Any]:
    child_chunks = []
    for idx, row in enumerate(retrieved_context or []):
        citation = row.get("citation") or {}
        text = row.get("text") or row.get("context") or citation.get("snippet") or ""
        child_chunks.append(
            {
                "rank": idx + 1,
                "chunk_id": row.get("chunk_id") or citation.get("id"),
                "source_document": citation.get("source") or row.get("source"),
                "source": citation.get("source") or row.get("source"),
                "title": citation.get("title"),
                "score": row.get("score"),
                "distance": row.get("distance"),
                "content_type": row.get("content_type") or citation.get("content_type") or "legacy_child_chunk",
                "page": citation.get("page"),
                "slide": citation.get("slide"),
                "content_preview": text[:600],
            }
        )

    return {
        "mode": "standard",
        "rag_triggered": not rag_gated,
        "gated": rag_gated,
        "course_code": course_id,
        "retrieved_child_chunks": child_chunks,
        "semantic_child_matches": child_chunks,
        "relationship_child_matches": [],
        "aggregated_child_support": [],
        "ranked_parent_chunks": [],
        "summary_activation": [],
        "channel_weights": {"semantic": 1.0, "relationship": 0.0},
        "selected_evidence_package": {
            "evidence_count": len(child_chunks),
            "citations": [row.get("citation") for row in retrieved_context or [] if row.get("citation")],
        },
        "warnings": ["Standard RAG uses legacy/simple child-chunk retrieval only; parent fusion and summary activation are disabled."],
    }


def _empty_harag_dev_trace(*, course_id: str, course_offering_id: Optional[str], rag_gated: bool) -> dict[str, Any]:
    return {
        "mode": "harag",
        "rag_triggered": not rag_gated,
        "gated": rag_gated,
        "course_code": course_id,
        "course_offering_id": course_offering_id,
        "semantic_child_matches": [],
        "relationship_child_matches": [],
        "aggregated_parent_scores": [],
        "linked_h1_summaries": [],
        "selected_parent_chunks": [],
        "channel_weights": {},
        "grounding": {},
        "retrieval_run_id": None,
        "warnings": ["HA-RAG retrieval did not run because the RAG confidence gate was closed." if rag_gated else "HA-RAG returned no evidence."],
    }


def _resolve_active_course_offering_id(db: Session, *, user_id: str, course_code: str | None) -> str | None:
    if not course_code:
        return None
    enrollment = (
        db.query(Enrollment)
        .join(CourseOffering, CourseOffering.id == Enrollment.offering_id)
        .filter(
            Enrollment.user_id == user_id,
            Enrollment.status == "active",
            CourseOffering.course_code == course_code,
            CourseOffering.is_active.is_(True),
        )
        .order_by(Enrollment.enrolled_at.desc())
        .first()
    )
    if enrollment:
        return str(enrollment.offering_id)
    offering = (
        db.query(CourseOffering)
        .filter(CourseOffering.course_code == course_code, CourseOffering.is_active.is_(True))
        .order_by(CourseOffering.created_at.desc())
        .first()
    )
    return str(offering.id) if offering else None


def _split_stream_chunk(text: str, max_words: int = MAX_WORDS_PER_STREAM_EVENT) -> list[str]:
    """Split a generated chunk into smaller pieces while preserving exact text reconstruction.

    LLM backends sometimes emit multi-word chunks. This helper breaks those chunks into
    shorter word groups (default: 1-3 words) so the UI renders a smoother typing effect.
    """
    if not text:
        return []

    if max_words <= 0:
        return [text]

    parts = re.findall(r"\S+|\s+", text)
    chunks: list[str] = []
    current_parts: list[str] = []
    words_in_current = 0

    for part in parts:
        is_word = not part.isspace()
        if is_word and words_in_current >= max_words and current_parts:
            chunks.append("".join(current_parts))
            current_parts = []
            words_in_current = 0

        current_parts.append(part)
        if is_word:
            words_in_current += 1

    if current_parts:
        chunks.append("".join(current_parts))

    return chunks


async def run_ai_pipeline(
    *,
    user_query: str,
    req: Request,
    db: Session,
    user_id: str,
    session_id: UUID,
    retrieval_mode: Optional[str] = None,
) -> QueryResponse:
    # Initialize components
    bloom_detector = req.app.state.bloom_detector
    competency_mapper = req.app.state.competency_mapper
    rag_engine = req.app.state.rag_engine
    harag_retriever = getattr(req.app.state, "harag_retriever", None)
    llm_client = req.app.state.llm_client
    llm_subclient= req.app.state.llm_subclient
    memory_manager = getattr(req.app.state, "memory_manager", None)
    pipeline_logger = getattr(req.app.state, "pipeline_logger", None)
    dev_mode = _dev_mode_enabled(req)
    resolved_retrieval_mode = _resolve_retrieval_mode(
        req,
        retrieval_mode,
        harag_available=harag_retriever is not None,
    )

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
    course_offering_id = _resolve_active_course_offering_id(db, user_id=user_id, course_code=course_id)

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
            competency = competency_mapper.map(
                user_query,
                db=db,
                course_offering_id=course_offering_id,
                course_code=course_id,
            )
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
            harag_package = None
            if resolved_retrieval_mode == "harag" and harag_retriever is not None:
                harag_package = harag_retriever.retrieve(
                    db,
                    query=user_query,
                    course_code=course_id,
                    course_offering_id=course_offering_id,
                    user_id=user_id,
                    session_id=str(session_id),
                    dev_mode=dev_mode,
                )
                retrieved_context = [
                    {"chunk_id": parent.parent_id, "context": parent.text, "similarity": parent.score}
                    for parent in harag_package.parents
                ]
                context_chunks = harag_package.context_blocks()
                citations = harag_package.citations
            else:
                retrieved_context = rag_engine.retrieve_bundle(user_query, course_id=course_id)
                context_chunks = [row.get("context", "") for row in retrieved_context]
                citations = [row.get("citation", {}) for row in retrieved_context if row.get("citation")]
            rag_gated = False
        else:
            harag_package = None
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
    with StageTimer() as prompt_timer:
        if harag_package is not None:
            final_prompt, prompt_trace = PromptEngine.build_harag_prompt(
                query=user_query,
                bloom_level=bloom_level,
                competency=competency,
                harag_package=harag_package,
                memory=memory_block,
            )
            if dev_mode:
                harag_package.trace["final_prompt_trace"] = prompt_trace
        else:
            prompt_trace = {
                "mode": "standard",
                "context_chunk_count": len(context_chunks),
                "has_memory": bool(memory_block),
            }
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

    # 8) generate (non-streaming)
    with StageTimer() as llm_timer:
        response_text = await run_in_threadpool(llm_client.generate, final_prompt)
    if harag_package is not None:
        grounding = EvidenceGroundingChecker().check(response_text, harag_package)
        harag_package.grounding = grounding
    else:
        grounding = {}
    
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
    if harag_package is not None:
        HARAGStorageService(db).record_grounding_check(
            retrieval_run_id=harag_package.retrieval_run_id,
            message_id=int(assistant_message.id) if getattr(assistant_message, "id", None) is not None else None,
            answer_text=response_text,
            diagnostics=grounding,
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

    response_payload = QueryResponse(
        query=user_query,
        bloom_level=bloom_level,
        prompt=final_prompt,
        response=response_text,
        course_id=course_id,
        citations=citations,
        message_id=int(assistant_message.id) if getattr(assistant_message, "id", None) is not None else None,
        retrieval_mode=resolved_retrieval_mode,
    )
    if dev_mode:
        timing = {
            "confidence_layer_ms": icl_timer.latency_ms,
            "bloom_detection_ms": bloom_timer.latency_ms,
            "cbc_mapping_ms": cbc_timer.latency_ms,
            "retrieval_ms": rag_timer.latency_ms,
            "prompt_assembly_ms": prompt_timer.latency_ms,
            "llm_generation_ms": llm_timer.latency_ms,
            "total_request_ms": total_latency_ms,
            "total_backend_pipeline_ms": total_latency_ms,
        }
        response_payload.dev_trace = {
            "query_metadata": {
                "user_query": user_query,
                "retrieval_mode": resolved_retrieval_mode,
                "dev_mode": dev_mode,
                "session_id": str(session_id),
                "course_id": course_id,
                "trace_id": trace_id,
            },
            "confidence_scores": confidence_scores,
            "confidence_layer": {
                "bloom_confidence": confidence_scores.get("bloom_conf"),
                "cbc_confidence": confidence_scores.get("cbc_conf"),
                "rag_confidence": confidence_scores.get("rag_conf"),
                "trigger_decisions": {
                    "bloom_gated": bloom_gated,
                    "cbc_gated": cbc_gated,
                    "rag_gated": rag_gated,
                },
            },
            "bloom": {"level": bloom_level, "confidence": confidence_scores.get("bloom_conf"), "gated": bloom_gated},
            "cbc": {"competencies": competency, "gated": cbc_gated, "confidence": confidence_scores.get("cbc_conf")},
            "rag": harag_package.to_dev_trace()
            if harag_package is not None
            else _empty_harag_dev_trace(
                course_id=course_id,
                course_offering_id=course_offering_id,
                rag_gated=rag_gated,
            )
            if resolved_retrieval_mode == "harag"
            else _standard_rag_dev_trace(
                retrieved_context=retrieved_context,
                course_id=course_id,
                rag_gated=rag_gated,
            ),
            "prompt_trace": {
                **prompt_trace,
                "preview": final_prompt[:2000],
                "context_summary": f"{len(context_chunks)} context chunk(s) appended",
            },
            "timing": timing,
            "grounding": grounding,
            "evidence": {
                "evidence_count": len(citations),
                "selected_citations": citations,
            },
            "warnings": [],
        }
    return response_payload


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
            retrieval_mode=request.retrieval_mode,
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
            retrieval_mode=None,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def run_ai_pipeline_streaming(
    *,
    user_query: str,
    req: Request,
    db: Session,
    user_id: str,
    session_id: Optional[UUID],
    course_id: Optional[str] = None,
    retrieval_mode: Optional[str] = None,
) -> AsyncGenerator[dict, None]:
    """Run AI pipeline with streaming LLM generation.
    
    Handles session creation if session_id is None.
    
    Yields SSE events:
        - status: Pipeline started with session info
        - session_created: New session created (only if session_id was None)
        - token: Each generated token with partial text
        - metadata: Periodic stats (every 10 tokens)
        - done: Final response with all pipeline data
        - error: If pipeline fails
    """
    # Initialize components
    bloom_detector = req.app.state.bloom_detector
    competency_mapper = req.app.state.competency_mapper
    rag_engine = req.app.state.rag_engine
    harag_retriever = getattr(req.app.state, "harag_retriever", None)
    llm_client = req.app.state.llm_client
    llm_subclient = req.app.state.llm_subclient
    memory_manager = getattr(req.app.state, "memory_manager", None)
    pipeline_logger = getattr(req.app.state, "pipeline_logger", None)
    dev_mode = _dev_mode_enabled(req)
    resolved_retrieval_mode = _resolve_retrieval_mode(
        req,
        retrieval_mode,
        harag_available=harag_retriever is not None,
    )

    trace_id = pipeline_logger.generate_trace_id() if pipeline_logger else None
    pipeline_start = time.perf_counter()
    is_new_session = session_id is None
    partial_text = ""

    try:
        # 0) Create session if needed
        if is_new_session:
            try:
                # Derive title from first message
                session_title = user_query[:50].strip() + ("..." if len(user_query) > 50 else "")
                
                new_session = crud_chats.create_chat_session(
                    db,
                    user_id=user_id,
                    course_id=course_id,
                    title=session_title,
                    auto_create_course=True,
                )
                session_id = new_session.id
                
                # Emit session_created event
                yield {
                    "session_id": str(session_id),
                    "session_title": session_title,
                }
            except Exception as e:
                if pipeline_logger:
                    pipeline_logger.log_error(
                        trace_id=trace_id,
                        stage="session_creation",
                        error=str(e),
                        error_type=type(e).__name__,
                    )
                yield {"error": f"Failed to create session: {str(e)}", "partial_response": "", "session_id": ""}
                return

        # Emit status event
        yield {
            "status": "started",
            "session_id": str(session_id),
            "is_new_session": is_new_session,
        }

        # 1) Validate session and get course_id
        try:
            resolved_course_id = crud_chats.get_session_course_id(db, user_id=user_id, session_id=session_id)
            if resolved_course_id is None:
                resolved_course_id = ""
        except ValueError as e:
            if pipeline_logger:
                pipeline_logger.log_error(
                    trace_id=trace_id,
                    stage="session_validation",
                    error=str(e),
                    error_type="ValueError",
                )
            yield {"error": str(e), "partial_response": "", "session_id": str(session_id)}
            return

        if pipeline_logger:
            pipeline_logger.log_input(
                query=user_query,
                user_id=user_id,
                session_id=session_id,
                course_id=resolved_course_id,
                trace_id=trace_id,
            )
        course_offering_id = _resolve_active_course_offering_id(db, user_id=user_id, course_code=resolved_course_id)

        # 2) Store user message
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
            yield {"error": str(e), "partial_response": "", "session_id": str(session_id)}
            return

        # 3) Intelligent Confidence Layer
        with StageTimer() as icl_timer:
            icl = IntelligentConfidenceLayer(llm_subclient)
            confidence_scores = await icl.compute(user_query)
        
        if pipeline_logger:
            pipeline_logger.log_confidence_scores(
                trace_id=trace_id,
                scores=confidence_scores,
                latency_ms=icl_timer.latency_ms,
            )

        # 4) Memory block
        memory_block = ""
        if memory_manager is not None:
            ctx_pack = memory_manager.build_context_pack(db, user_id, session_id, user_query)
            memory_block = _format_memory_block(ctx_pack)

        # 5) Bloom detection (gated)
        with StageTimer() as bloom_timer:
            if confidence_scores["bloom_conf"] > BLOOM_THRESHOLD:
                bloom_level = bloom_detector.detect(user_query)
                bloom_gated = False
            else:
                bloom_level = "No Bloom level detection"
                bloom_gated = True
        
        if pipeline_logger:
            pipeline_logger.log_bloom_detection(
                trace_id=trace_id,
                query=user_query,
                bloom_level=bloom_level,
                gated=bloom_gated,
                latency_ms=bloom_timer.latency_ms,
            )

        # 6) Competency mapping (gated)
        with StageTimer() as cbc_timer:
            if confidence_scores["cbc_conf"] > CBC_THRESHOLD:
                competency = competency_mapper.map(
                    user_query,
                    db=db,
                    course_offering_id=course_offering_id,
                    course_code=resolved_course_id,
                )
                cbc_gated = False
            else:
                competency = None
                cbc_gated = True
        
        if pipeline_logger:
            pipeline_logger.log_competency_mapping(
                trace_id=trace_id,
                query=user_query,
                competency=competency,
                gated=cbc_gated,
                latency_ms=cbc_timer.latency_ms,
            )

        # 7) RAG retrieve (gated, course-scoped)
        with StageTimer() as rag_timer:
            if confidence_scores["rag_conf"] > RAG_THRESHOLD:
                harag_package = None
                if resolved_retrieval_mode == "harag" and harag_retriever is not None:
                    harag_package = harag_retriever.retrieve(
                        db,
                        query=user_query,
                        course_code=resolved_course_id,
                        course_offering_id=course_offering_id,
                        user_id=user_id,
                        session_id=str(session_id),
                        dev_mode=dev_mode,
                    )
                    retrieved_context = [
                        {"chunk_id": parent.parent_id, "context": parent.text, "similarity": parent.score}
                        for parent in harag_package.parents
                    ]
                    context_chunks = harag_package.context_blocks()
                    citations = harag_package.citations
                else:
                    retrieved_context = rag_engine.retrieve_bundle(user_query, course_id=resolved_course_id)
                    context_chunks = [row.get("context", "") for row in retrieved_context]
                    citations = [row.get("citation", {}) for row in retrieved_context if row.get("citation")]
                rag_gated = False
            else:
                harag_package = None
                retrieved_context = []
                context_chunks = []
                citations = []
                rag_gated = True
        
        if pipeline_logger:
            pipeline_logger.log_rag_retrieval(
                trace_id=trace_id,
                query=user_query,
                course_id=resolved_course_id,
                chunks=retrieved_context,
                gated=rag_gated,
                latency_ms=rag_timer.latency_ms,
            )

        # 8) Build prompt
        with StageTimer() as prompt_timer:
            if harag_package is not None:
                final_prompt, prompt_trace = PromptEngine.build_harag_prompt(
                    query=user_query,
                    bloom_level=bloom_level,
                    competency=competency,
                    harag_package=harag_package,
                    memory=memory_block,
                )
                if dev_mode:
                    harag_package.trace["final_prompt_trace"] = prompt_trace
            else:
                prompt_trace = {
                    "mode": "standard",
                    "context_chunk_count": len(context_chunks),
                    "has_memory": bool(memory_block),
                }
                final_prompt = PromptEngine.build_prompt(
                    query=user_query,
                    bloom_level=bloom_level,
                    competency=competency,
                    context=context_chunks,
                    memory=memory_block,
                )
        
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

        # 9) Generate with streaming
        llm_start = time.perf_counter()
        token_count = 0
        partial_text = ""
        
        # Stream tokens from LLM; split oversized chunks for smoother UI typing
        for token in llm_client.generate_stream(final_prompt):
            for token_piece in _split_stream_chunk(token):
                token_count += 1
                partial_text += token_piece

                # Emit token event
                yield {
                    "token": token_piece,
                    "partial_text": partial_text,
                }
                await asyncio.sleep(0)

                # Emit metadata every 10 emitted pieces
                if token_count % 10 == 0:
                    elapsed = time.perf_counter() - llm_start
                    yield {
                        "tokens_generated": token_count,
                        "tokens_per_second": token_count / elapsed if elapsed > 0 else 0,
                        "partial_text": partial_text,
                    }
        
        response_text = partial_text
        if harag_package is not None:
            grounding = EvidenceGroundingChecker().check(response_text, harag_package)
            harag_package.grounding = grounding
        else:
            grounding = {}
        llm_elapsed = time.perf_counter() - llm_start
        
        if pipeline_logger:
            pipeline_logger.log_llm_generation(
                trace_id=trace_id,
                response=response_text,
                token_count=token_count,
                latency_ms=llm_elapsed * 1000,
            )

        # 10) Store assistant message
        assistant_message = crud_chats.append_message(
            db,
            user_id=user_id,
            session_id=session_id,
            role=MessageRole.assistant,
            content=response_text,
        )
        if harag_package is not None:
            HARAGStorageService(db).record_grounding_check(
                retrieval_run_id=harag_package.retrieval_run_id,
                message_id=int(assistant_message.id) if getattr(assistant_message, "id", None) is not None else None,
                answer_text=response_text,
                diagnostics=grounding,
            )

        # 11) Summarize memory
        if memory_manager is not None:
            memory_manager.maybe_summarize(db, user_id, session_id)

        # Calculate total latency
        total_latency = time.perf_counter() - pipeline_start
        
        if pipeline_logger:
            pipeline_logger.log_final_response(
                trace_id=trace_id,
                message_id=int(assistant_message.id) if getattr(assistant_message, "id", None) is not None else None,
                query=user_query,
                response=response_text,
                bloom_level=bloom_level,
                course_id=resolved_course_id,
                num_citations=len(citations),
                total_latency_ms=total_latency * 1000,
            )

        # Emit final done event
        done_event = {
            "full_response": response_text,
            "session_id": str(session_id),
            "citations": citations,
            "confidence_score": confidence_scores.get("rag_conf", 0.0),
            "retrieval_mode": resolved_retrieval_mode,
        }
        if dev_mode:
            total_latency_ms = total_latency * 1000
            timing = {
                "confidence_layer_ms": icl_timer.latency_ms,
                "bloom_detection_ms": bloom_timer.latency_ms,
                "cbc_mapping_ms": cbc_timer.latency_ms,
                "retrieval_ms": rag_timer.latency_ms,
                "prompt_assembly_ms": prompt_timer.latency_ms,
                "llm_generation_ms": llm_elapsed * 1000,
                "total_request_ms": total_latency_ms,
                "total_backend_pipeline_ms": total_latency_ms,
            }
            done_event["dev_trace"] = {
                "query_metadata": {
                    "user_query": user_query,
                    "retrieval_mode": resolved_retrieval_mode,
                    "dev_mode": dev_mode,
                    "session_id": str(session_id),
                    "course_id": resolved_course_id,
                    "trace_id": trace_id,
                },
                "confidence_scores": confidence_scores,
                "confidence_layer": {
                    "bloom_confidence": confidence_scores.get("bloom_conf"),
                    "cbc_confidence": confidence_scores.get("cbc_conf"),
                    "rag_confidence": confidence_scores.get("rag_conf"),
                    "trigger_decisions": {
                        "bloom_gated": bloom_gated,
                        "cbc_gated": cbc_gated,
                        "rag_gated": rag_gated,
                    },
                },
                "bloom": {"level": bloom_level, "confidence": confidence_scores.get("bloom_conf"), "gated": bloom_gated},
                "cbc": {"competencies": competency, "gated": cbc_gated, "confidence": confidence_scores.get("cbc_conf")},
                "rag": harag_package.to_dev_trace()
                if harag_package is not None
                else _empty_harag_dev_trace(
                    course_id=resolved_course_id,
                    course_offering_id=course_offering_id,
                    rag_gated=rag_gated,
                )
                if resolved_retrieval_mode == "harag"
                else _standard_rag_dev_trace(
                    retrieved_context=retrieved_context,
                    course_id=resolved_course_id,
                    rag_gated=rag_gated,
                ),
                "prompt_trace": {
                    **prompt_trace,
                    "preview": final_prompt[:2000],
                    "context_summary": f"{len(context_chunks)} context chunk(s) appended",
                },
                "timing": timing,
                "grounding": grounding,
                "evidence": {
                    "evidence_count": len(citations),
                    "selected_citations": citations,
                },
                "warnings": [],
            }
        yield done_event

    except Exception as e:
        if pipeline_logger:
            pipeline_logger.log_error(
                trace_id=trace_id,
                stage="streaming_pipeline",
                error=str(e),
                error_type=type(e).__name__,
            )
        yield {
            "error": str(e),
            "partial_response": partial_text,
            "session_id": str(session_id) if session_id else "",
        }


@router.post("/ai-query/stream")
async def ai_query_stream_endpoint(
    request: AIQueryStreamRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unified streaming endpoint - handles session creation AND streaming.
    
    Every message streams through the full AI pipeline.
    If session_id is None, creates a new session first.
    """
    user_id = str(current_user.id)
    
    # Convert session_id string to UUID if provided
    session_uuid = None
    if request.session_id:
        try:
            session_uuid = UUID(request.session_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid session_id format")
    
    async def event_generator():
        async for event_data in run_ai_pipeline_streaming(
            user_query=request.message,
            req=req,
            db=db,
            user_id=user_id,
            session_id=session_uuid,
            course_id=request.course_id,
            retrieval_mode=request.retrieval_mode,
        ):
            # Format as SSE
            yield {"data": json.dumps(event_data)}
    
    return EventSourceResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
