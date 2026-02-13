"""
EduSmart Ingestion Service

This package handles document ingestion for the EduSmart adaptive learning platform.

Exports a stable public API for:
- loading documents (PDF/DOCX/PPTX)
- semantic chunking
- OCR processing
- end-to-end ingestion pipeline
"""
from .document_loader import DocumentLoader
from .text_chunker import SemanticChunker, Chunk
from .ingestion_pipeline import IngestionPipeline, IngestionResult
from .ocr_engine import OCREngine, OCRResult
from .exceptions import UnsupportedFileTypeError, FileCorruptedError, ExtractionFailedError

__all__ = [
    # core
    "IngestionPipeline",
    "IngestionResult",
    # components (useful for unit tests)
    "DocumentLoader",
    "SemanticChunker",
    "Chunk",
    "OCREngine",
    "OCRResult",
    # exceptions
    "UnsupportedFileTypeError",
    "FileCorruptedError",
    "ExtractionFailedError",
]
