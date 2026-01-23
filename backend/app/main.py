from backend.app.routes import ai_query, ingestion
from fastapi import FastAPI

app = FastAPI()

app.include_router(ai_query.router)
app.include_router(ingestion.router)

@app.get("/health")
def health():
    return {"status": "ok"}
