# Lecturer Ingestion Mode Integration Report

## Files changed
- `frontend/react-app/src/pages/LecturerWorkspacePage.tsx`
- `frontend/react-app/src/services/api.ts`
- `backend/app/routes/ingestion_router.py`
- `backend/app/services/ingestion/ingestion_pipeline.py`
- `backend/app/services/harag/ingestion_orchestrator.py`
- `backend/app/services/harag/storage_service.py`

## Frontend changes
- Added a per-upload ingestion mode selector in the Lecturer Workspace uploads tab.
- Modes are `Standard RAG` and `HA-RAG`.
- Upload requests now send:
  - `course_id`
  - `course_offering_id`
  - `ingestion_mode`
  - existing file payload
- Lecturer upload success feedback now includes the mode used and indexed chunk count when available.
- Recent upload rows display the selected ingestion mode.

## Backend routing changes
- `POST /ingest/upload` now accepts `ingestion_mode=standard|harag`.
- The route passes the selected mode to `IngestionPipeline.ingest()`.
- Upload responses now include:
  - `ingestion_mode`
  - `standard_stored_vectors`
  - `harag_stored_vectors`
  - existing status, document id, chunk, OCR, course, offering, and warning fields.
- If `ingestion_mode` is omitted, the backend defaults to `standard` for legacy compatibility.

## Schema changes
- No database migration was added.
- The selected mode is reflected in retrieval metadata:
  - Standard RAG: Chroma chunk metadata includes `ingestion_mode`.
  - HA-RAG: hierarchy table `metadata` JSON fields include `ingestion_mode`.

## Standard RAG ingestion
- Standard mode uses the legacy/simple path:
  - document loading
  - semantic chunking
  - E5 embeddings
  - Chroma storage in the course collection
  - OCR chunk storage where available
- Standard mode deletes any existing HA-RAG hierarchy for the same stable document id so the upload is not indexed into HA-RAG.

## HA-RAG ingestion
- HA-RAG mode uses the existing HA-RAG orchestrator:
  - structural parsing
  - H1 summaries
  - parent chunks
  - overlapping child chunks
  - child embeddings
  - entity extraction
  - relationship extraction
  - PostgreSQL persistence
- HA-RAG mode removes any existing Standard RAG Chroma vectors for the same stable document id so the upload is not indexed into Standard RAG.

## Request/response contract
- Request query parameter:
  - `ingestion_mode`: `standard` or `harag`
  - default: `standard`
- Frontend API option:
  - `ingestionApi.uploadDocument(token, file, courseId, { courseOfferingId, ingestionMode })`
- Response additions:
  - `ingestion_mode`
  - `standard_stored_vectors`
  - `harag_stored_vectors`

## Validation performed
- `python3 -m py_compile backend/app/routes/ingestion_router.py backend/app/services/ingestion/ingestion_pipeline.py backend/app/services/harag/ingestion_orchestrator.py backend/app/services/harag/storage_service.py`
- `npm run build` in `frontend/react-app`

## Known limitations
- Live upload validation was not run in this environment because it requires a running authenticated backend, database, vector store, and document fixture.
- HA-RAG mode currently skips OCR image chunk ingestion; the text hierarchy path is fully routed.
- Historical upload lists only show `ingestion_mode` if the backend source includes it; recent uploads show the selected mode immediately.
