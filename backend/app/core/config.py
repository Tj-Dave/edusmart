from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings
from typing import List
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[3]  

class Settings(BaseSettings):
    # =====================================================
    # Application Settings
    # =====================================================

    APP_NAME: str = "EduSmart"
    APP_ENV: str = "development"          # development | staging | production
    APP_DEBUG: bool = True

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000


    # =====================================================
    # FastAPI / Server Settings
    # =====================================================

    FASTAPI_WORKERS: int = 1
    FASTAPI_RELOAD: bool = True


    # =====================================================
    # LLM Configuration (llama.cpp + Gemma)
    # =====================================================

    LLM_BACKEND: str = "llama.cpp"         # llama.cpp

    LLM_MODE: str = "desktop"                  # cpu | desktop | gpu

    LLM_MODEL_CPU_PATH: Path = BASE_DIR / "models" / "gemma-3-12b-pt-q4_0.gguf"
    LLM_MODEL_DESKTOP_PATH: Path = BASE_DIR / "models" / "gemma-3n-q4_k_m.gguf"
    LLM_MODEL_GPU_PATH: Path = BASE_DIR / "models" / "gemma-4b.gguf"

    LLM_CONTEXT_SIZE: int = 4096
    LLM_THREADS: int = 8
    LLM_MAX_TOKENS: int = 512
    LLM_TEMPERATURE: float = 0.7
    LLM_TOP_P: float = 0.9


    # =====================================================
    # Embedding Model Configuration
    # =====================================================

    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
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

    @property
    def llm_model_path(self) -> str:
        """
        Return the correct LLM model path based on LLM_MODE.
        """
        if self.LLM_MODE == "cpu":
            return self.LLM_MODEL_CPU_PATH
        elif self.LLM_MODE == "desktop":
            return self.LLM_MODEL_DESKTOP_PATH
        elif self.LLM_MODE == "gpu":
            return self.LLM_MODEL_GPU_PATH
        else:
            raise ValueError(f"Invalid LLM_MODE: {self.LLM_MODE}")

    @property
    def allowed_file_types_list(self) -> List[str]:
        """
        Return allowed file types as a list.
        """
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


# This is what the rest of the app will import
settings = get_settings()
