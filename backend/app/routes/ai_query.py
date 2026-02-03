from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.models.schemas import QueryRequest, QueryResponse
from app.services.prompt_engine import PromptEngine

router = APIRouter()


def _get_ids(req: Request) -> tuple[str, str]:
    # Use headers if provided, otherwise default.
    user_id = req.headers.get("X-User-Id", "anon")
    session_id = req.headers.get("X-Session-Id", "default")
    return user_id, session_id


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


async def run_ai_pipeline(user_query: str, req: Request):
    bloom_detector = req.app.state.bloom_detector
    competency_mapper = req.app.state.competency_mapper
    rag_engine = req.app.state.rag_engine
    llm_client = req.app.state.llm_client
    memory_manager = req.app.state.memory_manager

    user_id, session_id = _get_ids(req)

    # 0) Store the user turn
    memory_manager.append_message(user_id, session_id, "user", user_query)

    # 0.1) Occasionally compress older turns into long-term memory (Phi-3)
    memory_manager.maybe_summarize(user_id, session_id)

    # 0.2) Fetch memory context for this query
    ctx_pack = memory_manager.build_context_pack(user_id, session_id, user_query)
    memory_block = _format_memory_block(ctx_pack)

    # 1) Bloom
    bloom_level = bloom_detector.detect(user_query)

    # 2) Competency mapping
    competency = competency_mapper.map(user_query)

    # 3) RAG retrieve
    context_chunks = rag_engine.retrieve(user_query)

    # 4) Build prompt (NOW includes memory)
    final_prompt = PromptEngine.build_prompt(
        query=user_query,
        bloom_level=bloom_level,
        competency=competency,
        context=context_chunks,
        memory=memory_block
    )

    # 5) Generate answer
    response_text = await run_in_threadpool(llm_client.generate, final_prompt)

    # 6) Store assistant turn
    memory_manager.append_message(user_id, session_id, "assistant", response_text)

    return QueryResponse(
        query=user_query,
        bloom_level=bloom_level,
        prompt=final_prompt,
        response=response_text
    )


@router.post("/ai-query", response_model=QueryResponse)
async def ai_query(request: QueryRequest, req: Request):
    try:
        return await run_ai_pipeline(request.query, req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-query", response_model=QueryResponse)
async def ai_query_browser(query: str, req: Request):
    try:
        return await run_ai_pipeline(query, req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
