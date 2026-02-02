from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.models.schemas import QueryRequest, QueryResponse
from app.services.bloom_detector import BloomDetector
from app.services.competency_mapper import CompetencyMapper
from app.services.rag_engine import RAGEngine
from app.services.prompt_engine import PromptEngine
from app.services.multiQuery import MultiQuery


bloom_detector = BloomDetector()
competency_mapper = CompetencyMapper()
rag_engine = RAGEngine()

router = APIRouter()

async def run_ai_pipeline(user_query: str, req: Request):

    # 1. Detect Bloom cognitive level
    bloom_level = bloom_detector.detect(user_query)

    queries = MultiQuery.generate_variants(user_query, n=5)

    # 2. Map to curriculum competency
    competency = competency_mapper.map(user_query)

    # 3. Retrieve relevant content from vector DB
    context_chunks = rag_engine.retrieve(user_query)

    # 4. Build final prompt
    final_prompt = PromptEngine.build_prompt(
        query=user_query,
        bloom_level=bloom_level,
        competency=competency,
        context=context_chunks
    )

    # 5. Run LLM inference in threadpool
    response_text = await run_in_threadpool(req.app.state.llm_client.generate, final_prompt)

    return QueryResponse(
        query=user_query,
        bloom_level=bloom_level,
        prompt = final_prompt,
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
    """
    Browser-friendly GET endpoint.
    Example:
    /ai-query?query=Explain Newton's First Law
    """
    try:
        return await run_ai_pipeline(query, req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
