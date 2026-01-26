from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.models.schemas import QueryRequest, QueryResponse
from app.services.bloom_detector import BloomDetector
from app.services.competency_mapper import CompetencyMapper
from app.services.rag_engine import RAGEngine
from app.services.prompt_engine import PromptEngine
from app.services.llm.llama_cpp_client import LLMClient

router = APIRouter()


@router.post("/ai-query", response_model=QueryResponse)
async def ai_query(request: QueryRequest):
    """
    Main AI query endpoint.
    Orchestrates Bloom detection → Competency mapping → RAG → Prompt → LLM.
    """

    try:
        user_query = request.query

        # 1. Detect Bloom cognitive level
        bloom_level = BloomDetector.detect(user_query)

        # 2. Map to curriculum competency
        competency = CompetencyMapper.map(user_query)

        # 3. Retrieve relevant content from vector DB
        context_chunks = RAGEngine.retrieve(user_query, competency)

        # 4. Build final prompt
        final_prompt = PromptEngine.build_prompt(
            query=user_query,
            bloom_level=bloom_level,
            competency=competency,
            context=context_chunks
        )

        # 5. Run LLM inference in threadpool
        llm = LLMClient()
        response_text = await run_in_threadpool(llm.generate, final_prompt)

        return QueryResponse(
            query=user_query,
            bloom_level=bloom_level,
            competency=competency,
            response=response_text
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
