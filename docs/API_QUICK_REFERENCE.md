"""
Quick reference for ingestion endpoints and testing.
"""

# ============================================================================
# ENDPOINTS
# ============================================================================

POST /api/v1/ingest/upload
    Description: Upload and process educational document
    Content-Type: multipart/form-data
    Body: 
        file: (binary) - PDF, DOCX, or PPTX file
    
    Response (200 OK):
        {
            "document_id": "uuid-string",
            "status": "success" | "partial_success" | "failed",
            "total_chunks": 42,
            "processed_images": 5,
            "ocr_pending": 5,
            "filename": "biology.pdf"
        }
    
    Errors:
        400: Invalid file type
        500: Processing failed

GET /api/v1/ingest/status/{document_id}
    Description: Check ingestion status (placeholder)
    Response:
        {
            "document_id": "uuid-string",
            "status": "completed",
            "message": "Status tracking not yet implemented"
        }

# ============================================================================
# TESTING COMMANDS
# ============================================================================

# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the server
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. Test with cURL
curl -X POST "http://localhost:8000/api/v1/ingest/upload" \
  -F "file=@path/to/test.pdf"

# 4. Test with Python
python << 'EOF'
import requests

url = "http://localhost:8000/api/v1/ingest/upload"
with open("test.pdf", "rb") as f:
    response = requests.post(url, files={"file": f})
    print(response.json())
EOF

# 5. Test ingestion pipeline directly (no API)
cd backend
python test_ingestion_flow.py

# ============================================================================
# FILE LOCATIONS
# ============================================================================

API Endpoints:        backend/app/routes/ingestion.py
Pipeline Logic:       backend/app/services/ingestion/ingestion_pipeline.py
Document Loader:      backend/app/services/ingestion/document_loader.py
Text Chunker:         backend/app/services/ingestion/text_chunker.py
Embedder:             backend/app/services/ingestion/embedder.py
Vector Store:         backend/app/db/vector_store.py
File Utils:           backend/app/utils/file_utils.py
Config:               backend/app/core/config.py

Upload Directory:     backend/data/uploads/
ChromaDB Directory:   backend/data/chroma_db/

# ============================================================================
# COMMON ISSUES
# ============================================================================

Issue: "ModuleNotFoundError: No module named 'fitz'"
Fix: pip install PyMuPDF

Issue: "ModuleNotFoundError: No module named 'docx'"
Fix: pip install python-docx

Issue: "ModuleNotFoundError: No module named 'pptx'"
Fix: pip install python-pptx

Issue: Embedding model download is slow
Reason: all-MiniLM-L6-v2 downloads on first use (~80MB)
Fix: Wait for download, then it's cached locally

Issue: "File type not allowed"
Fix: Only .pdf, .docx, .pptx are supported

Issue: Out of memory during embedding
Fix: Reduce batch_size in embedder.py (currently 8)

# ============================================================================
# MONITORING LOGS
# ============================================================================

The system logs structured output. Look for:
- "Upload request received" - File uploaded
- "Document loaded" - Parsing complete
- "Embeddings stored" - Database write complete
- "Document ingested" - Full pipeline complete
- "Ingestion failed" - Error occurred

Example log:
{
    "event": "Document ingested",
    "document_id": "abc123",
    "status": "success",
    "chunks": 42
}

# ============================================================================
# CURRICULUM SPEC / ROADMAP / ASSESSMENT / PROGRESS (NEW)
# ============================================================================

Auth header for all examples:
Authorization: Bearer <JWT>

1) Extract course spec draft from an already ingested blueprint document:

curl -X POST "http://localhost:8000/offerings/{offering_id}/specs/extract" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{
        "document_id": "00000000-0000-0000-0000-000000000000",
        "mode": "extract_only"
      }'

2) Approve the reviewed spec:

curl -X POST "http://localhost:8000/specs/{spec_id}/approve" \
  -H "Authorization: Bearer <JWT>"

3) Generate and activate roadmap:

curl -X POST "http://localhost:8000/offerings/{offering_id}/roadmap/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"archive_existing_drafts": true}'

curl -X POST "http://localhost:8000/offerings/{offering_id}/roadmap/activate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"archive_existing_active": true}'

4) Create a task under roadmap item:

curl -X POST "http://localhost:8000/roadmap-items/{item_id}/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{
        "title": "Quiz 1",
        "task_type": "quiz",
        "max_score": 20,
        "max_attempts": 2,
        "attempt_scoring_rule": "best",
        "allow_late_submission": true,
        "late_penalty_percent": 10
      }'

5) Student attempt lifecycle:

curl -X POST "http://localhost:8000/enrollments/{enrollment_id}/tasks/{task_id}/attempts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{}'

curl -X POST "http://localhost:8000/enrollments/{enrollment_id}/tasks/{task_id}/attempts/1/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"evidence_url":"https://example.com/submission/1"}'

curl -X POST "http://localhost:8000/enrollments/{enrollment_id}/tasks/{task_id}/attempts/1/grade" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"score": 18, "feedback":"Strong work"}'

6) Student roadmap with progress and rollups:

curl -X GET "http://localhost:8000/enrollments/{enrollment_id}/roadmap" \
  -H "Authorization: Bearer <JWT>"
