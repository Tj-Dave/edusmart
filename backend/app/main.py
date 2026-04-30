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
from app.services.logging.pipeline_logger import PipelineLogger

from app.routes.ai_query import router as ai_query_router
from app.routes.chats import router as chats_router
from app.routes.auth import router as auth_router
from app.routes.ingestion_router import router as ingestion_router
from app.routes.courses import router as courses_router
from app.routes.enrollments import router as enrollments_router
from app.routes.course_specs import router as course_specs_router
from app.routes.roadmap import router as roadmap_router
from app.routes.assessments import router as assessments_router
from app.routes.progress import router as progress_router
from app.routes.gamification import router as gamification_router
from app.routes.notifications_sse import router as notifications_sse_router
from app.routes.admin import router as admin_router

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

pipeline_logger = PipelineLogger(log_dir="logs")

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
app.state.pipeline_logger = pipeline_logger

# Routers
app.include_router(auth_router)
app.include_router(chats_router)
app.include_router(ai_query_router)
app.include_router(ingestion_router)
app.include_router(courses_router)
app.include_router(enrollments_router)
app.include_router(course_specs_router)
app.include_router(roadmap_router)
app.include_router(assessments_router)
app.include_router(progress_router)
app.include_router(gamification_router)
app.include_router(notifications_sse_router)
app.include_router(admin_router)

@app.on_event("startup")
async def startup_event():
    """Start background services on application startup."""
    await app.state.pipeline_logger.start()

@app.on_event("shutdown")
async def shutdown_event():
    """Stop background services on application shutdown."""
    await app.state.pipeline_logger.stop()

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
