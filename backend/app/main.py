from app.routes import ai_query, ingestion
from fastapi import FastAPI
from app.core.config import settings

app = FastAPI()

app.include_router(ai_query.router)
app.include_router(ingestion.router)

@app.get("/health")
def health():
    return {"status": "ok"}
