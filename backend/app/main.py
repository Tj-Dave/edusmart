from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool

from app.core.config import settings
from app.services.llm.llama_cpp_client import LLMClient
from app.services.llm.llama_cpp_subclient import LLMSubclient
from app.services.multiQuery import MultiQuery

from app.services.embedder.e5_embedder import E5Embedder
from app.services.competency_mapper import CompetencyMapper
from app.services.bloom_detector import BloomDetector
from app.services.rag_engine import RAGEngine
from app.db.vector_store import VectorStore
from app.services.memory.memory_manager import MemoryManager

from app.routes.ai_query import router as ai_query_router

app = FastAPI(title="EduSmart Backend")

# Initialize once at startup
llm_client = LLMClient()
llm_subclient = LLMSubclient()
multi_query_service = MultiQuery(llm_subclient)

vector_store = VectorStore()
embedder = E5Embedder(device="cpu")
competency_mapper = CompetencyMapper(embedder)
bloom_detector = BloomDetector()          # if this loads a model, keep it here too
rag_engine = RAGEngine(vector_store=vector_store, embedder=embedder)                  # you’ll later inject embedder into this too

memory_manager = MemoryManager(
    sqlite_path=str(settings.BASE_DIR / "data" / "chat_memory.sqlite"),
    vector_store=vector_store,
    embed_query=embedder.embed_query,
    embed_texts=embedder.embed_texts,  # passage embeddings for stored memory
    phi3=llm_subclient,                # Phi-3 mini summarizer
    app_namespace="edusmart"
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
    variants = app.state.multi_query_service.generate_variants(q, n=5)
    return {"original_query": q, "variants": variants}
