from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from app.core.config import settings
from app.services.llm.llama_cpp_client import LLMClient
from app.services.llm.llama_cpp_subclient import LLMSubclient
from app.services.multiQuery import MultiQuery
from app.routes.ai_query import router as ai_query_router

app = FastAPI(title="EduSmart Backend")

# Initialize LLM clients once at startup
llm_client = LLMClient()
llm_subclient = LLMSubclient()
multi_query_service = MultiQuery(llm_subclient)

# Make clients available globally
app.state.llm_client = llm_client
app.state.llm_subclient = llm_subclient
app.state.multi_query_service = multi_query_service

app.include_router(ai_query_router)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/test-llm")
async def test_llm():
    result = await run_in_threadpool(app.state.llm_client.generate, "Say hello briefly.")
    return {"response": result}

@app.get("/test-multi-query")
async def test_multi_query(q: str):
    """Test endpoint for multi-query generation"""
    variants = app.state.multi_query_service.generate_variants(q, n=5)
    return {
        "original_query": q,
        "variants": variants
    }

