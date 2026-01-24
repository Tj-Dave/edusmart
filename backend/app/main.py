from app.routes import ai_query, ingestion
from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from app.core.config import settings
from app.services.llm import LLMClient

app = FastAPI()

# app.include_router(ai_query.router)
# app.include_router(ingestion.router)

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/test-llm")
async def test_llm():
    llm = LLMClient()
    result = await run_in_threadpool(llm.generate, "Say hello briefly.")
    return {"response": result}

