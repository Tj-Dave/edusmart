# 🎓 EduSmart Ingestion Service - Learning Guide

## 📚 What You've Built

A document ingestion system that transforms educational PDFs, DOCX, and PPTX files into AI-searchable vectors. 

## 🔄 The Flow (Step-by-Step)

```
[Teacher uploads file via API]
           ↓
[POST /api/v1/ingest/upload]  ← API Endpoint (routes/ingestion.py)
           ↓
[IngestionPipeline.ingest()]  ← Orchestrator
           ↓
[DocumentLoader.load()]  ← Extract text & images
           ↓
[SemanticChunker.chunk()]  ← Split into 512-token pieces
           ↓
[EmbeddingService.embed_chunks()]  ← Convert to vectors
           ↓
[VectorStore.add_documents()]  ← Save to ChromaDB
           ↓
[OCREngine.process_image()]  ← Process images (v2.0 placeholder)
           ↓
[Return IngestionResult]
           ↓
[JSON response to client]
```

## 🧩 Component Breakdown

### 1. **API Endpoint** ([routes/ingestion.py](backend/app/routes/ingestion.py))
**What it does:** Receives file uploads from teachers  
**Why it's needed:** Exposes ingestion as HTTP endpoint  
**Key code:**
- `@router.post("/upload")` - Maps POST requests to function
- `UploadFile` - FastAPI handles multipart file uploads
- Creates temporary file, processes it, then deletes

### 2. **Document Loader** ([services/ingestion/document_loader.py](backend/app/services/ingestion/document_loader.py))
**What it does:** Extracts text and images from documents  
**Why it's needed:** Different file formats need different parsers  
**Supports:**
- **PDF** - Uses PyMuPDF (fitz)
- **DOCX** - Uses python-docx
- **PPTX** - Uses python-pptx
**Returns:** Plain text + list of image paths

### 3. **Text Chunker** ([services/ingestion/text_chunker.py](backend/app/services/ingestion/text_chunker.py))
**What it does:** Splits long text into smaller pieces  
**Why it's needed:** AI models have token limits (optimal size ~512 tokens)  
**Features:**
- Splits on sentence boundaries (no mid-word splits)
- Preserves metadata (source file, document ID)
- 50-token overlap between chunks for continuity

### 4. **Embedding Service** ([services/ingestion/embedder.py](backend/app/services/ingestion/embedder.py))
**What it does:** Converts text chunks to vectors  
**Why it's needed:** Computers compare numbers faster than text  
**How it works:**
- Model: `all-MiniLM-L6-v2` (80MB, CPU-only)
- Output: 384-dimensional vectors
- Batches 8 chunks at a time (prevents memory overflow)
- "Photosynthesis is..." → [0.23, -0.15, 0.87, ...384 numbers...]

### 5. **Vector Store** ([db/vector_store.py](backend/app/db/vector_store.py))
**What it does:** Stores chunks + embeddings in ChromaDB  
**Why it's needed:** Fast semantic search across documents  
**Methods:**
- `add_documents(texts, embeddings, metadatas)` - Store chunks
- `query(embedding, n_results)` - Find similar chunks

### 6. **OCR Engine** ([services/ingestion/ocr_engine.py](backend/app/services/ingestion/ocr_engine.py))
**What it does:** Placeholder for image text extraction  
**Current Status:** Returns "pending" (v2.0 feature)  
**Future:** Will use Tesseract or PaddleOCR

### 7. **Ingestion Pipeline** ([services/ingestion/ingestion_pipeline.py](backend/app/services/ingestion/ingestion_pipeline.py))
**What it does:** Orchestrates all components  
**Why it's needed:** Single entry point for the entire process  
**Steps:**
1. Load document
2. Chunk text
3. Generate embeddings
4. Store to ChromaDB
5. Process images with OCR
6. Return summary

## 🧪 How to Test

### Option 1: API Test (with cURL)
```bash
# Start the server
cd backend
uvicorn app.main:app --reload

# Upload a file
curl -X POST "http://localhost:8000/api/v1/ingest/upload" \
  -F "file=@test.pdf"
```

### Option 2: API Test (with Python)
```python
import requests

url = "http://localhost:8000/api/v1/ingest/upload"
with open("biology.pdf", "rb") as f:
    files = {"file": f}
    response = requests.post(url, files=files)
    print(response.json())
```

## 📊 Expected Output

```json
{
  "document_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "success",
  "total_chunks": 42,
  "processed_images": 5,
  "filename": "biology.pdf"
}
```

## 📝 Logging

All stages are logged with structlog:
```
logger.info("ingestion_started", file=..., document_id=...)
logger.info("document_loaded", text_length=..., image_count=...)
logger.info("text_chunked", chunk_count=...)
logger.info("embeddings_generated", embedding_count=...)
logger.info("storing_to_vector_db", count=...)
logger.info("ingestion_completed", document_id=..., total_chunks=..., ocr_pending=...)
```

## 💡 Key Concepts Used

| Concept | Where Used | Why |
|---------|-----------|-----|
| **Type Hints** | `def load(file_path: Path) -> Tuple[str, List[Path]]` | Catch bugs early |
| **Async/Await** | `async def upload_document()` | Handle multiple uploads |
| **Pydantic Models** | `class Chunk(BaseModel)` | Data validation |
| **Structured Logging** | `logger.info(..., document_id=...)` | Debug in production |
| **Singleton Pattern** | `get_pipeline()` - Reuse model | Optimize memory |
| **Exception Handling** | Custom exceptions | Clear error messages |

## 🌍 Kenyan Context Adaptations

1. **Offline-First** - No external API calls (works without internet)
2. **Low-Resource** - CPU-only, batch size 8 (old laptops supported)
3. **Swahili Support** - Preserves mixed Swahili/English text
4. **Small Model** - 80MB model (downloads quickly on slow connections)

## 📁 File Structure

```
backend/app/
├── routes/
│   └── ingestion.py                 # API endpoint
├── services/ingestion/
│   ├── document_loader.py           # PDF/DOCX/PPTX reader
│   ├── text_chunker.py              # Text splitting
│   ├── embedder.py                  # Vector generation
│   ├── ocr_engine.py                # Image processing (stub)
│   ├── ingestion_pipeline.py        # Main orchestrator
│   ├── exceptions.py                # Custom errors
│   └── __init__.py                  # Package exports
└── db/
    └── vector_store.py              # ChromaDB wrapper
```

---

💡 **To understand the flow:** Start by reading the docstrings in `ingestion_pipeline.py`, then trace each method call to the component files.
