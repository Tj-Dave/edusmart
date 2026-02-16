from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db.postgres import engine

from app.services.llm.llama_cpp_client import LLMClient
from app.services.llm.llama_cpp_subclient import LLMSubclient
from app.services.multiQuery import MultiQuery

from app.services.embedder.e5_embedder import E5Embedder
from app.services.competency_mapper import CompetencyMapper
from app.services.bloom_detector import BloomDetector
from app.services.rag_engine import RAGEngine
from app.db.vector_store import VectorStore
from app.services.memory.memory_manager import MemoryManagerPG

from app.routes.ai_query import router as ai_query_router
from app.routes.chats import router as chats_router
from app.routes.auth import router as auth_router
from app.routes.ingestion import router as ingestion_router  # ✅ add

app = FastAPI(title="EduSmart Backend")

# ✅ CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize once at startup
llm_client = LLMClient()
llm_subclient = LLMSubclient()
multi_query_service = MultiQuery(llm_subclient)

vector_store = VectorStore()
embedder = E5Embedder(device="cpu")
competency_mapper = CompetencyMapper(embedder)
bloom_detector = BloomDetector()
rag_engine = RAGEngine(vector_store=vector_store, embedder=embedder)

memory_manager = MemoryManagerPG(
    vector_store=vector_store,
    embed_query=embedder.embed_query,
    embed_texts=embedder.embed_texts,
    phi3=llm_subclient,
    app_namespace="edusmart",
)

# Store in app.state
app.state.llm_client = llm_client
app.state.llm_subclient = llm_subclient
app.state.multi_query_service = multi_query_service

app.state.vector_store = vector_store
app.state.embedder = embedder
app.state.competency_mapper = competency_mapper
app.state.bloom_detector = bloom_detector
app.state.rag_engine = rag_engine
app.state.memory_manager = memory_manager

# Routers
app.include_router(auth_router)
app.include_router(chats_router)
app.include_router(ai_query_router)
app.include_router(ingestion_router)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/test-llm")
async def test_llm():
    result = await run_in_threadpool(app.state.llm_client.generate, "Say hello briefly.")
    return {"response": result}

@app.get("/test-multi-query")
async def test_multi_query(q: str):
    variants = app.state.multi_query_service.generate_variants(q, n=5)
    return {"original_query": q, "variants": variants}

@app.get("/db-health")
def db_health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"db": "ok"}
