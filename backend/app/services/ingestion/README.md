# 📦 EduSmart Document Ingestion

## What It Does

Takes educational documents (PDF, DOCX, PPTX) and prepares them for AI search:
1. **Loads** - Reads the file and extracts text + images
2. **Chunks** - Splits text into ~512 token pieces  
3. **Embeds** - Converts each piece to 384 numbers (vector)
4. **Stores** - Saves to ChromaDB for fast searching
5. **Returns** - Gives you a document ID and chunk count

## The Pipeline

```
Upload File → Load → Chunk → Embed → Store in ChromaDB → Done
```

## Components

| Component | Does | Example |
|-----------|------|---------|
| **DocumentLoader** | Reads PDF/DOCX/PPTX | `biology.pdf` → 15,000 words |
| **SemanticChunker** | Splits into pieces | 15,000 words → 42 chunks |
| **EmbeddingService** | Text to vectors | Each chunk → 384 numbers |
| **VectorStore** | Saves to database | 42 chunks → ChromaDB |
| **IngestionPipeline** | Orchestrates all steps | Runs 1-5 in order |
| **OCREngine** | Process extracted images | Integrated pipeline step (text extraction v2.0) |

## How to Use

### Upload a Document (API)
```bash
curl -X POST "http://localhost:8000/api/v1/ingest/upload" \
  -F "file=@biology.pdf"
```

**Response:**
```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "total_chunks": 42,
  "processed_images": 5,
  "filename": "biology.pdf"
}
```

## Logging

All steps are logged with structlog:
- `initializing_pipeline` - Setup
- `loading_document` - File reading
- `text_chunked` - Splitting done
- `embeddings_generated` - Vectors created
- `storing_to_vector_db` - ChromaDB save
- `ingestion_completed` - Success

## Performance

- **Speed:** 5-10 seconds per 20-page PDF
- **Model:** all-MiniLM-L6-v2 (80MB, CPU-only)
- **Batch Size:** 8 chunks (prevents memory issues)
- **Languages:** English, Swahili, mixed

## File Structure

```
ingestion/
├── document_loader.py       # PDF/DOCX/PPTX parsing
├── text_chunker.py          # Text splitting (512 tokens, 50 overlap)
├── embedder.py              # Vector generation
├── ocr_engine.py            # Image processing (stub)
├── ingestion_pipeline.py    # Orchestrator + logging
├── exceptions.py            # Custom errors
└── __init__.py              # Package exports
```

## Supported Formats

- **.pdf** - via PyMuPDF (fitz)
- **.docx** - via python-docx  
- **.pptx** - via python-pptx

## Error Handling

Returns `status: "failed"` + logs error details if:
- Unsupported file type
- Corrupted file
- Extraction failure

---

Built for EduSmart - CBC adaptive learning for Kenya 🇰🇪
