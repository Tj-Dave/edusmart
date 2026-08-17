from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import List, ClassVar
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()  # loads backend/.env

class Settings(BaseSettings):
    # =====================================================
    # Application Settings
    # =====================================================

    APP_NAME: str = "EduSmart"
    APP_ENV: str = "development"          # development | staging | production
    APP_DEBUG: bool = True

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    BASE_DIR: ClassVar[Path] = Path(__file__).resolve().parents[3]

    # =====================================================
    # FastAPI / Server Settings
    # =====================================================

    FASTAPI_WORKERS: int = 1
    FASTAPI_RELOAD: bool = True

    # =====================================================
    # Database Configuration
    # =====================================================

    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # =====================================================
    # llama.cpp (shared)
    # =====================================================

    LLM_BACKEND: str = "llama.cpp"         # llama.cpp
    LLM_MODE: str = "gpu"                  # cpu | desktop | gpu
    LLAMA_CPP_BINARY: Path = BASE_DIR / "bin" / "llama-cli"

    # =====================================================
    # QUERY LLM (fast) - Phi-3 Mini for multi-query expansion
    # =====================================================

    QUERY_LLM_ENABLED: bool = True
    QUERY_LLM_MODEL_FAMILY: str = "phi-3-mini"

    QUERY_LLM_MODEL_CPU_PATH: Path = BASE_DIR / "models" / "Phi-3-mini-4k-instruct-q4.gguf"
    QUERY_LLM_MODEL_DESKTOP_PATH: Path = BASE_DIR / "models" / "Phi-3-mini-4k-instruct-q4.gguf"
    QUERY_LLM_MODEL_GPU_PATH: Path = BASE_DIR / "models" / "Phi-3-mini-4k-instruct-q4.gguf"

    QUERY_LLM_CONTEXT_SIZE: int = 2048
    QUERY_LLM_THREADS: int = 8
    QUERY_LLM_MAX_TOKENS: int = 1024
    QUERY_LLM_TEMPERATURE: float = 0.3
    QUERY_LLM_TOP_P: float = 0.9

    QUERY_LLM_N_GPU_LAYERS: int = 8
    QUERY_LLM_N_BATCH: int = 128
    QUERY_LLM_GPU_F16_KV: bool = True

    # =====================================================
    # FINAL LLM (strong) - Gemma for final inference/answering
    # =====================================================

    FINAL_LLM_ENABLED: bool = True
    FINAL_LLM_MODEL_FAMILY: str = "gemma"

    FINAL_LLM_MODEL_CPU_PATH: Path = BASE_DIR / "models" / "gemma-3n-q4_k_m.gguf"
    FINAL_LLM_MODEL_DESKTOP_PATH: Path = BASE_DIR / "models" / "gemma-3n-q4_k_m.gguf"
    FINAL_LLM_MODEL_GPU_PATH: Path = BASE_DIR / "models" / "gemma-3n-q4_k_m.gguf"

    FINAL_LLM_CONTEXT_SIZE: int = 4096
    FINAL_LLM_THREADS: int = 8
    FINAL_LLM_MAX_TOKENS: int = 1024
    FINAL_LLM_TEMPERATURE: float = 0.7
    FINAL_LLM_TOP_P: float = 0.9

    FINAL_LLM_N_GPU_LAYERS: int = 12
    FINAL_LLM_N_BATCH: int = 256
    FINAL_LLM_GPU_F16_KV: bool = True

    # =====================================================
    # Embedding Model Configuration
    # =====================================================

    EMBEDDING_MODEL_NAME: str = "intfloat/e5-base-v2"
    EMBEDDING_DEVICE: str = "cpu"          # cpu | cuda (future)

    # =====================================================
    # Vector Database (ChromaDB)
    # =====================================================

    VECTOR_DB_TYPE: str = "chroma"
    VECTOR_DB_PATH: str = "./data/chroma_db"
    VECTOR_DB_COLLECTION: str = "edusmart_knowledge_base"

    # =====================================================
    # Data Directories
    # =====================================================

    DATA_ROOT: str = "./data"

    CURRICULUM_DOCS_DIR: str = "./data/curriculum_docs"
    LECTURER_UPLOADS_DIR: str = "./data/lecturer_uploads"
    RAW_IMAGES_DIR: str = "./data/raw_images"
    EMBEDDINGS_DIR: str = "./data/embeddings"

    # =====================================================
    # File Upload & Ingestion Settings
    # =====================================================

    MAX_UPLOAD_FILE_SIZE_MB: int = 50
    ALLOWED_FILE_TYPES: str = "pdf,docx,pptx,jpg,jpeg,png"

    TEXT_CHUNK_SIZE: int = 500
    TEXT_CHUNK_OVERLAP: int = 100

    # =====================================================
    # OCR Configuration (Future)
    # =====================================================

    OCR_ENABLED: bool = False
    OCR_ENGINE: str = "tesseract"
    OCR_LANGUAGE: str = "eng"

    # =====================================================
    # Security & Authentication (Future)
    # =====================================================

    SECRET_KEY: str = "change_this_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h


    # =====================================================
    # Logging Configuration
    # =====================================================

    LOG_LEVEL: str = "INFO"
    LOG_TO_FILE: bool = False
    LOG_FILE_PATH: str = "./logs/app.log"

    # =====================================================
    # Development / Testing Flags
    # =====================================================

    ENABLE_MOCK_LLM: bool = False
    ENABLE_RAG: bool = True
    ENABLE_INGESTION: bool = True

    # =====================================================
    # Helper Properties
    # =====================================================

    def _pick_path_by_mode(self, cpu_path: Path, desktop_path: Path, gpu_path: Path) -> Path:
        if self.LLM_MODE == "cpu":
            return cpu_path
        if self.LLM_MODE == "desktop":
            return desktop_path
        if self.LLM_MODE == "gpu":
            return gpu_path
        raise ValueError(f"Invalid LLM_MODE: {self.LLM_MODE}")

    @property
    def query_llm_model_path(self) -> Path:
        return self._pick_path_by_mode(
            self.QUERY_LLM_MODEL_CPU_PATH,
            self.QUERY_LLM_MODEL_DESKTOP_PATH,
            self.QUERY_LLM_MODEL_GPU_PATH,
        )

    @property
    def final_llm_model_path(self) -> Path:
        return self._pick_path_by_mode(
            self.FINAL_LLM_MODEL_CPU_PATH,
            self.FINAL_LLM_MODEL_DESKTOP_PATH,
            self.FINAL_LLM_MODEL_GPU_PATH,
        )

    @property
    def allowed_file_types_list(self) -> List[str]:
        return [ft.strip().lower() for ft in self.ALLOWED_FILE_TYPES.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# =====================================================
# Singleton Settings Instance
# =====================================================

@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
