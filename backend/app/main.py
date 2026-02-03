from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from app.core.config import settings
from app.services.llm import LLMClient
from app.routes.ai_query import router as ai_query_router
from app.routes.ingestion import router as ingestion_router

app = FastAPI(title="EduSmart Backend")

# Register all API route groups
app.include_router(ai_query_router)
app.include_router(ingestion_router)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/test-llm")
async def test_llm():
    llm = LLMClient()
    result = await run_in_threadpool(llm.generate, "Say hello briefly.")
    return {"response": result}

