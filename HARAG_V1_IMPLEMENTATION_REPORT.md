# HA-RAG V1 Implementation Report

## What changed
- Added HA-RAG V1 as a PostgreSQL-backed retrieval and context-construction subsystem.
- Kept `/chats/*` as the canonical query surface and changed chat orchestration to prefer HA-RAG packages when RAG confidence fires.
- Preserved legacy Chroma retrieval as fallback compatibility only; HA-RAG storage/query now uses PostgreSQL tables and pgvector.
- Rebuilt ingestion to persist an H1 -> dynamic parent chunk -> overlapping child chunk hierarchy.
- Added child-level semantic retrieval, relationship retrieval, parent-centric fusion, structural H1 summary activation, citation packaging, grounding diagnostics, and dev-mode traces.
- Upgraded CBC mapping to use offering/course structured competencies before legacy CSV/npy fallback.
- Added lecturer request and admin approval/rejection flow for course-level document sharing.
- Added offline retrieval evaluation scaffolding and focused HA-RAG tests.

## Migrations added
- `backend/alembic/versions/e5d42f1b7c61_harag_v1_pgvector.py`
  - Enables `vector` extension.
  - Adds `course_offering_id` and `source_scope` to `ingested_documents`.
  - Adds HA-RAG hierarchy tables: `document_sections`, `h1_summaries`, `parent_chunks`, `child_chunks`, `child_chunk_embeddings`.
  - Adds extraction tables: `extracted_entities`, `extracted_relationships`.
  - Adds sharing/evaluation/observability tables: `document_sharing_requests`, `retrieval_runs`, `retrieval_evidence`, `grounding_checks`, `retrieval_eval_sets`, `retrieval_eval_results`.

## Files created
- `backend/app/services/harag/*`
- `backend/alembic/versions/e5d42f1b7c61_harag_v1_pgvector.py`
- `backend/app/tests/test_harag_v1.py`
- `backend/app/tests/fixtures/harag_eval_sample.json`
- `backend/scripts/run_harag_eval.py`
- `HARAG_V1_IMPLEMENTATION_REPORT.md`

## Files modified
- Backend models, metadata store, ingestion pipeline, chat/AI query routes, prompt engine, CBC mapper, admin routes/schemas, main app initialization.
- Frontend chat streaming hook, student message type/workspace, admin RAG monitoring page, and API client.

## Architecture summary
- HA-RAG is modular under `backend/app/services/harag/`.
- Ingestion pipeline:
  1. Parse extracted text into H1-bounded `SectionBlock`s.
  2. Generate one H1 summary per section.
  3. Build dynamic parent chunks inside H1 boundaries.
  4. Build overlapping child chunks.
  5. Generate local embeddings for child chunks.
  6. Extract entities and child-grounded relationships locally.
  7. Persist all artifacts into PostgreSQL.
- Retrieval pipeline:
  1. Semantic child retrieval.
  2. Relationship retrieval resolved to child chunks.
  3. Parent-centric weighted fusion.
  4. Structural summary activation from ranked parents.
  5. Evidence/citation packaging for prompt assembly.

## Storage summary
- PostgreSQL is now the HA-RAG source of truth.
- Child embeddings are stored in `child_chunk_embeddings.embedding vector(768)` with JSON fallback data in `embedding_json`.
- Retrieval scoping uses `course_code`, optional `course_offering_id`, and `source_scope`.
- Approved shared documents are visible at course level; pending/rejected/offering-only documents remain offering-scoped.

## Retrieval flow summary
- Child chunks are the primary retrieval units.
- Semantic and relationship matches aggregate by child, then roll up to parent chunks.
- Parent chunks are ranked by weighted frequency/support scoring.
- H1 summaries are activated through parent `summary_id` linkage, not direct summary vector search.
- Parent chunks are the citation units returned to the chat UI.

## Dev mode summary
- Dev traces are only returned when `APP_DEBUG` is true and the request includes `X-EduSmart-Dev-Mode: true`, `X-Dev-Mode: true`, or `?dev_mode=true`.
- Frontend sends the header when `localStorage.edusmart_dev_mode === "true"`.
- Trace includes confidence decisions, Bloom/CBC data, semantic/relationship matches, parent scores, summary activation, selected parent chunks, prompt preview, channel weights, and grounding diagnostics.

## Admin sharing flow summary
- Lecturer/uploader can call `POST /ingest/documents/{document_id}/share-course`.
- Admin can review pending requests in the RAG monitoring page.
- Admin endpoints:
  - `GET /api/admin/rag/sharing-requests`
  - `POST /api/admin/rag/sharing-requests/{request_id}/approve`
  - `POST /api/admin/rag/sharing-requests/{request_id}/reject`
- Approval updates document and HA-RAG artifact scope to `course_shared_approved`.

## Evaluation tooling summary
- `backend/scripts/run_harag_eval.py` runs offline retrieval evaluation from JSON/JSONL.
- Metrics include evidence hit rate, parent selection hit rate, latency, selected parents, and channel mix.
- Sample dataset scaffold: `backend/app/tests/fixtures/harag_eval_sample.json`.

## Known limitations
- Image/OCR-specific HA-RAG hierarchy handling remains a placeholder; existing OCR flow is left intact as legacy ingestion behavior.
- Relationship extraction uses the local LLM when present and falls back to heuristics.
- Pgvector dimension is fixed at 768 for the current E5 base embedding model.
- Tests were added, but this environment does not have `pytest` installed, so they could not be executed here.
- A pre-existing indentation error in `backend/app/services/notification/service.py` stops full backend compileall outside the touched files.

## Verification
- `python3` AST parse passed for all touched Python files.
- `npm run build` passed for the React frontend.
- `pytest` could not run because the module is not installed in the current environment.

## Next-step recommendations
- Apply the Alembic migration on a PostgreSQL instance with pgvector available.
- Re-ingest lecturer documents so HA-RAG hierarchy tables are populated.
- Add a small labeled course dataset and run `backend/scripts/run_harag_eval.py`.
- Add richer relationship-query matching and admin charts once real retrieval traces accumulate.
