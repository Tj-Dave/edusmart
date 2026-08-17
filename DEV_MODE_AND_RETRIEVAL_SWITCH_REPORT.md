# Dev Mode and Retrieval Switch Report

## Files changed
- `frontend/react-app/src/modules/student/StudentWorkspace.tsx`
- `frontend/react-app/src/hooks/useLLMStream.ts`
- `frontend/react-app/src/services/api.ts`
- `backend/app/routes/chats.py`
- `backend/app/routes/ai_query.py`
- `backend/app/models/chat_schemas.py`
- `backend/app/models/schemas.py`
- `backend/app/services/rag_engine.py`

## UI changes
- Added a student chat header toggle for developer diagnostics.
- Developer mode persists in `localStorage` as `edusmart_dev_mode`.
- Added a segmented retrieval-mode control with `Standard RAG` and `HA-RAG`.
- Retrieval mode persists in `localStorage` as `edusmart_retrieval_mode`.
- When dev mode is off, the chat remains the normal single-pane workflow.
- When dev mode is on, the chat stays usable on the left and a scrollable diagnostics panel appears on the right on wide screens, stacking below on smaller screens.
- Removed inline assistant-message debug JSON in favor of the right-side diagnostics panel.
- Fixed an invalid header DOM pattern by replacing a `<p>` wrapper around block content with a `<div>`.

## Request and response contract changes
- Streaming chat requests now send:
  - payload field: `retrieval_mode: "standard" | "harag"`
  - header: `X-EduSmart-Retrieval-Mode`
  - header: `X-EduSmart-Dev-Mode: true` only when dev mode is enabled
- Non-streaming chat API helpers accept optional `{ devMode, retrievalMode }` options and send the same headers/mode field.
- Backend `/chats/stream`, `/chats/{session_id}/messages`, and `/chats/query` accept retrieval mode and pass it into the canonical AI pipeline.
- Backend responses include `dev_trace` only when dev mode is enabled by backend gating.
- Streaming final events include `retrieval_mode`.

## Retrieval mode routing
- Default is `harag` because this repository currently initializes `app.state.harag_retriever` and was already using HA-RAG whenever available.
- `harag` mode uses the existing `HARAGRetrievalOrchestrator`.
- `standard` mode uses the legacy/simple `RAGEngine.retrieve_bundle()` path.
- `standard` mode does not call HA-RAG parent fusion, summary activation, or relationship retrieval.
- Standard diagnostics adapt legacy Chroma results into child-chunk-style records with chunk id, source, distance, content type, and preview.

## Diagnostics shown
- Query metadata: user query, retrieval mode, dev mode, session id, course id, trace id.
- Confidence layer: Bloom/CBC/RAG scores and gating decisions.
- Bloom detection: detected level, confidence, and gated state.
- CBC mapping: mapped competencies plus confidence/gating metadata when available.
- Retrieval:
  - Standard: retrieved child chunks, scores/distances, source document, chunk ids, previews.
  - HA-RAG: semantic child matches, relationship matches, aggregated scores, selected parent chunks, summary activation, channel weights.
- Prompt diagnostics: prompt trace, prompt preview, context summary.
- Grounding/evidence: grounding result, evidence count, selected citations.
- Warnings/errors: available warnings and missing-field-safe placeholders.

## Timing fields added
- `confidence_layer_ms`
- `bloom_detection_ms`
- `cbc_mapping_ms`
- `retrieval_ms`
- `prompt_assembly_ms`
- `llm_generation_ms`
- `total_request_ms`
- `total_backend_pipeline_ms`
- frontend `round_trip_ms` when available in the streaming hook

## Validation performed
- `python3 -m py_compile backend/app/routes/ai_query.py backend/app/routes/chats.py backend/app/models/schemas.py backend/app/models/chat_schemas.py backend/app/services/rag_engine.py`
- `npm run build` in `frontend/react-app`
- Attempted backend tests with `pytest` and `python3 -m pytest`; pytest is not installed in this environment.

## Known limitations
- Standard RAG diagnostics reflect legacy Chroma chunks as child chunks; if older indexed metadata lacks rich child identifiers, the panel falls back to Chroma ids or citation ids.
- Full browser interaction checks and console DOM-warning checks were not run here.
- Some HA-RAG diagnostic fields only appear when the existing HA-RAG retriever provides them.
