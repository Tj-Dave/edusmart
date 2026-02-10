import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db.postgres import engine

from app.core.config import settings

# Optional LLM services - may not be available during development
try:
    from app.services.llm.llama_cpp_client import LLMClient
    from app.services.llm.llama_cpp_subclient import LLMSubclient
    from app.services.multiQuery import MultiQuery
    LLM_AVAILABLE = True
except ImportError:
    logger_temp = logging.getLogger(__name__)
    logger_temp.warning("⚠️  LLM services not available (llama-cpp-python not installed)")
    LLM_AVAILABLE = False
    LLMClient = None
    LLMSubclient = None
    MultiQuery = None

# Optional embedder services
try:
    from app.services.embedder.e5_embedder import E5Embedder
    EMBEDDER_AVAILABLE = True
except ImportError:
    logger_temp = logging.getLogger(__name__)
    logger_temp.warning("⚠️  Embedder services not available")
    EMBEDDER_AVAILABLE = False
    E5Embedder = None

# Optional ML services
try:
    from app.services.competency_mapper import CompetencyMapper
    from app.services.bloom_detector import BloomDetector
    from app.services.rag_engine import RAGEngine
    from app.db.vector_store import VectorStore
    from app.services.memory.memory_manager import MemoryManagerPG
    ML_SERVICES_AVAILABLE = True
except ImportError:
    logger_temp = logging.getLogger(__name__)
    logger_temp.warning("⚠️  ML services not available (missing dependencies)")
    ML_SERVICES_AVAILABLE = False
    CompetencyMapper = None
    BloomDetector = None
    RAGEngine = None
    VectorStore = None
    MemoryManagerPG = None

from app.routes.ai_query import router as ai_query_router
from app.routes.chats import router as chats_router
from app.routes.auth_demo import router as auth_router
from app.routes.admin import router as admin_router

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app startup and shutdown"""
    # Startup
    logger.info("🚀 Initializing EduSmart Backend...")
    
    try:
        # Initialize LLM services (optional)
        llm_client = None
        llm_subclient = None
        multi_query_service = None
        embedder = None
        vector_store = None
        
        if LLM_AVAILABLE:
            logger.info("📦 Loading LLM services...")
            llm_client = LLMClient()
            llm_subclient = LLMSubclient()
            multi_query_service = MultiQuery(llm_subclient)
        else:
            logger.warning("⚠️  LLM services skipped (not available)")
        
        # Initialize vector store and embeddings (optional)
        if EMBEDDER_AVAILABLE:
            logger.info("📚 Loading embedder and vector store...")
            vector_store = VectorStore()
            embedder = E5Embedder(device="cpu")
        else:
            logger.warning("⚠️  Embedder services skipped (not available)")
        
        # Initialize ML services
        logger.info("🧠 Loading competency mapper and bloom detector...")
        competency_mapper = CompetencyMapper(embedder) if embedder else None
        bloom_detector = BloomDetector()
        rag_engine = RAGEngine(vector_store=vector_store, embedder=embedder) if vector_store and embedder else None
        
        # Initialize memory manager (optional)
        memory_manager = None
        if vector_store and embedder and llm_subclient:
            logger.info("💾 Initializing memory manager...")
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
        
        # Test database connection
        logger.info("🗄️ Testing database connection...")
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("✅ Database connected successfully")
        
        logger.info("✨ EduSmart Backend initialized successfully!")
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}", exc_info=True)
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down EduSmart Backend...")


app = FastAPI(
    title="EduSmart Backend",
    description="AI-powered educational assistant with RAG and memory management",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in dev; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ai_query_router, prefix="/api", tags=["ai_query"])
app.include_router(chats_router, prefix="/api", tags=["chats"])
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(admin_router, prefix="/api", tags=["admin"])


# Health check endpoints
@app.get("/health")
def health():
    """Quick health check"""
    return {"status": "ok", "service": "EduSmart Backend"}


@app.get("/ready")
def readiness():
    """Readiness check - ensures all services are initialized"""
    try:
        # Check database
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        # Check that all required services are available
        required_services = [
            "llm_client",
            "llm_subclient",
            "vector_store",
            "embedder",
            "rag_engine",
            "memory_manager",
        ]
        
        for service in required_services:
            if not hasattr(app.state, service):
                return {"status": "not_ready", "missing": service}, 503
        
        return {"status": "ready", "services": required_services}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return {"status": "not_ready", "error": str(e)}, 503


@app.get("/test-llm")
async def test_llm():
    """Test LLM response generation"""
    try:
        result = await run_in_threadpool(
            app.state.llm_client.generate, 
            "Say hello briefly in 1 sentence."
        )
        return {"status": "ok", "response": result}
    except Exception as e:
        logger.error(f"LLM test failed: {e}")
        return {"status": "error", "error": str(e)}, 500


@app.get("/test-multi-query")
async def test_multi_query(q: str):
    """Test multi-query variant generation"""
    try:
        variants = app.state.multi_query_service.generate_variants(q, n=5)
        return {"status": "ok", "original_query": q, "variants": variants}
    except Exception as e:
        logger.error(f"Multi-query test failed: {e}")
        return {"status": "error", "error": str(e)}, 500


@app.get("/test-db")
def test_db():
    """Test database connection"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            return {"status": "ok", "message": "Database connection successful"}
    except Exception as e:
        logger.error(f"Database test failed: {e}")
        return {"status": "error", "error": str(e)}, 500


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )
