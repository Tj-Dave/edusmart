# EduSmart / EduScape AI Repository Technical Context Report

Generated from repository scan on `2026-05-09`.

Repository root: `/home/raven/EduSmart/edusmart`

## Executive Summary

This repository is a full-stack academic platform centered on a FastAPI backend and a React/Vite frontend, with local/offline AI inference through `llama.cpp`, embeddings through `sentence-transformers`, relational state in PostgreSQL, and vector retrieval in ChromaDB.

The current branch is `feature/harag`, but the code currently looks more like a consolidated `dev/streaming` branch than a branch with an implemented Hierarchical Adaptive RAG system. `git log` shows `HEAD` at commit `d84ad63` with message `feat: Implement real-time streaming for Student and Lecturer chat interfaces`, and that same commit is shared by `origin/feat/streaming`, `feat/streaming`, `origin/dev`, and `dev`. I did **not** find HA-RAG-specific retrieval hierarchy, adaptive routing, entity graph storage, relationship extraction, source-grounding evaluation, or summary-tree logic in the current scan.

What **is** already present:

- A working AI query pipeline entrypoint in [backend/app/routes/ai_query.py](backend/app/routes/ai_query.py)
- Course-scoped document ingestion in [backend/app/services/ingestion/ingestion_pipeline.py](backend/app/services/ingestion/ingestion_pipeline.py)
- Course-scoped Chroma retrieval in [backend/app/services/rag_engine.py](backend/app/services/rag_engine.py)
- Curriculum support via Bloom detection and CBC competency mapping in [backend/app/services/bloom_detector.py](backend/app/services/bloom_detector.py) and [backend/app/services/competency_mapper.py](backend/app/services/competency_mapper.py)
- Structured course-spec extraction and roadmap generation in [backend/app/services/course_spec_service.py](backend/app/services/course_spec_service.py) and [backend/app/services/roadmap_service.py](backend/app/services/roadmap_service.py)
- Streaming chat UX in [frontend/react-app/src/hooks/useLLMStream.ts](frontend/react-app/src/hooks/useLLMStream.ts), [frontend/react-app/src/modules/student/StudentWorkspace.tsx](frontend/react-app/src/modules/student/StudentWorkspace.tsx), and [frontend/react-app/src/components/lecturer/LecturerAssistantPanel.tsx](frontend/react-app/src/components/lecturer/LecturerAssistantPanel.tsx)

Main conclusion: the repository is a strong foundation for a **course-scoped local RAG system**, but it is **not yet HA-RAG-ready without additional architecture**. The cleanest path is to extend the current ingestion, metadata, vector storage, and prompt assembly layers rather than replacing them.

---

## 1. Current Branch Context

### Active branch

- `feature/harag`

### Observed branch purpose

- Branch name suggests upcoming HA-RAG work.
- Actual HEAD commit and adjacent history suggest this branch currently inherits the streaming/chat integration work rather than containing HA-RAG implementation.
- Most recent visible commits:
  - `d84ad63` `feat: Implement real-time streaming for Student and Lecturer chat interfaces`
  - `9dcfe64` `feat: Add per-call parameter overrides to LLMSubclient`
  - older grading/admin/student-feature commits

### Practical interpretation

- Treat this branch as a **pre-HA-RAG baseline**.
- It already contains:
  - unified chat streaming
  - document ingestion
  - simple course-scoped RAG
  - curriculum-aligned prompting
  - roadmap/assessment/grading subsystems
- It does **not** yet contain:
  - hierarchical retrieval
  - adaptive query routing
  - entity/relationship extraction storage
  - graph/table hybrid retrieval
  - evidence-grounded answer planning
  - formal retrieval evaluation framework

---

## 2. Repository Structure Summary

### Top level

- `backend/`: FastAPI app, DB models, routes, services, tests, Alembic, scripts
- `frontend/react-app/`: main web frontend built with React + TypeScript + Vite
- `frontend/electron/`: placeholder Electron shell, mostly empty
- `frontend/web/`: empty directory
- `data/`: Chroma persistence, uploads, legacy SQLite memory DB, extracted artifacts
- `docs/`: implementation notes, architecture notes, API reference, thesis-related docs, sample course documents
- `models/`: local GGUF model files for `llama.cpp`
- `scripts/`: shell/python helper scripts
- `README.md`: architecture description, but partially out of sync with current code

### Backend folder map

- `backend/app/main.py`: FastAPI entry point and singleton service initialization
- `backend/app/routes/`: HTTP API layer
- `backend/app/services/`: business logic, AI pipeline, ingestion, roadmap, grading, logging, auth helpers
- `backend/app/db/`: SQLAlchemy models, CRUD helpers, Chroma wrapper, schema SQL files
- `backend/app/models/`: Pydantic request/response schemas
- `backend/app/core/`: config, SSE manager, Redis/RQ event-bus helpers
- `backend/app/tests/`: unit/integration-style tests and diagnostic scripts
- `backend/alembic/`: migration framework
- `backend/scripts/`: migration helper and log-analysis utilities

### Frontend folder map

- `frontend/react-app/src/App.tsx`: route shell
- `frontend/react-app/src/pages/`: page-level screens
- `frontend/react-app/src/components/`: UI components
- `frontend/react-app/src/modules/student/`: student workspace module
- `frontend/react-app/src/services/api.ts`: fetch wrappers to backend
- `frontend/react-app/src/state/`: auth and course context state
- `frontend/react-app/src/hooks/useLLMStream.ts`: SSE chat stream consumer

### Data / storage folders

- `data/chroma_db/`: persistent Chroma vector DB
- `data/uploads/<COURSE>/`: uploaded source files per course
- `data/curriculum_docs/`, `data/lecturer_uploads/`, `data/raw_images/`: storage roots declared in config
- `data/chat_memory.sqlite`: appears legacy; current chat memory path uses PostgreSQL + Chroma, not this SQLite file

### Documentation areas

- `docs/API_QUICK_REFERENCE.md`
- `docs/FRONTEND_OVERVIEW.md`
- `docs/INGESTION_GUIDE.md`
- `docs/INTELLIGENT_CONFIDENCE_LAYER.md`
- `docs/PIPELINE_LOGGER.md`
- `docs/api/openapi.yaml`

### Unclear, stale, empty, or likely unused artifacts

- `frontend/electron/package.json`, `frontend/electron/main.js`, `frontend/electron/preload.js`, `frontend/electron/src/services/api_client.js`: present but empty
- `frontend/web/`: empty
- `models/README.md`: empty
- `scripts/ingest_seed_data.py`: empty
- `backend/=1.6.5`: stray text file containing pip output; likely accidental artifact
- `frontend/react-app/node_modules/`, `frontend/react-app/dist/`, `frontend/react-app/.vite/`: checked-in generated/dependency artifacts
- `docs/INGESTION_GUIDE.md`: references outdated paths and component names
- `README.md`: describes `/api/ai/*` and `/api/ingest/*`, but actual routes differ

---

## 3. Technology Stack

### Languages

- Python backend
- TypeScript + React frontend
- SQLAlchemy ORM + raw SQL migration helpers
- SQL migration SQL files and Alembic

### Backend framework

- FastAPI in [backend/app/main.py](backend/app/main.py)
- Uvicorn listed in [backend/requirements.txt](backend/requirements.txt)

### Frontend framework

- React 18 + React Router 6 + Vite in [frontend/react-app/package.json](frontend/react-app/package.json)
- Zustand for persistent course context in [frontend/react-app/src/state/courseStore.ts](frontend/react-app/src/state/courseStore.ts)
- Tailwind CSS in [frontend/react-app/tailwind.config.js](frontend/react-app/tailwind.config.js)

### Database and storage

- PostgreSQL via SQLAlchemy and `psycopg2-binary`
- ChromaDB persistent vector storage via [backend/app/db/vector_store.py](backend/app/db/vector_store.py)
- Local files for uploaded docs and extracted images
- Legacy SQLite file `data/chat_memory.sqlite` exists, but current memory manager uses PostgreSQL + Chroma

### AI / LLM stack

- `llama_cpp_python` for local inference
- `SentenceTransformer` for embeddings and Bloom detection
- Local GGUF model files:
  - `models/Phi-3-mini-4k-instruct-q4.gguf`
  - `models/gemma-3-4b-pt-q4_0.gguf`
  - `models/gemma-3n-q4_k_m.gguf`

### Embeddings

- E5 embeddings via [backend/app/services/embedder/e5_embedder.py](backend/app/services/embedder/e5_embedder.py)
- CBC curriculum embeddings precomputed in:
  - [backend/app/utils/cbc_metadata.csv](backend/app/utils/cbc_metadata.csv)
  - [backend/app/utils/cbc_embeddings.npy](backend/app/utils/cbc_embeddings.npy)
  - generation script in [backend/app/utils/CBC_embed.py](backend/app/utils/CBC_embed.py)

### AI-related libraries from `backend/requirements.txt`

- `llama_cpp_python`
- `sentence-transformers`
- `transformers`
- `torch`
- `chromadb`
- `scikit-learn`
- `PyMuPDF`
- `python-docx`
- `python-pptx`
- `langchain`, `langgraph`, `langsmith`

Note: I found **no actual LangChain or LangGraph integration in the scanned backend modules** despite those packages being installed.

### Auth

- JWT bearer auth in [backend/app/services/auth/security.py](backend/app/services/auth/security.py)
- Password hashing with `passlib`
- Backend imports `python-jose` style module as `from jose import jwt, JWTError`

### Testing

- `pytest`
- `pytest-asyncio`
- backend tests under `backend/app/tests/`

### Config / manifests found

- [backend/requirements.txt](backend/requirements.txt)
- [backend/alembic.ini](backend/alembic.ini)
- [frontend/react-app/package.json](frontend/react-app/package.json)
- [frontend/react-app/package-lock.json](frontend/react-app/package-lock.json)
- [frontend/react-app/vite.config.ts](frontend/react-app/vite.config.ts)
- [frontend/react-app/tailwind.config.js](frontend/react-app/tailwind.config.js)
- `backend/.env` exists but was **not** read for secrets

### Missing or inconsistent package declarations

- `backend/app/services/auth/security.py` imports `jose`, but `python-jose` is **not present** in [backend/requirements.txt](backend/requirements.txt)
- `backend/app/core/redis.py` and [backend/app/core/event_bus.py](backend/app/core/event_bus.py) use `redis` and `rq`, but neither package appears in [backend/requirements.txt](backend/requirements.txt)

---

## 4. Backend Architecture

### Entry point

Main backend entrypoint is [backend/app/main.py](backend/app/main.py).

It:

- creates `FastAPI(title="EduSmart Backend")`
- enables localhost-only CORS for Vite
- instantiates long-lived singletons:
  - `LLMClient`
  - `LLMSubclient`
  - `MultiQuery`
  - `VectorStore`
  - `E5Embedder`
  - `CompetencyMapper`
  - `BloomDetector`
  - `RAGEngine`
  - `MemoryManagerPG`
  - `PipelineLogger`
- stores them in `app.state`
- registers routers
- starts/stops the pipeline logger on app lifecycle events

### Registered routers

From [backend/app/main.py](backend/app/main.py):

- [backend/app/routes/auth.py](backend/app/routes/auth.py)
- [backend/app/routes/chats.py](backend/app/routes/chats.py)
- [backend/app/routes/ai_query.py](backend/app/routes/ai_query.py)
- [backend/app/routes/ingestion_router.py](backend/app/routes/ingestion_router.py)
- [backend/app/routes/courses.py](backend/app/routes/courses.py)
- [backend/app/routes/enrollments.py](backend/app/routes/enrollments.py)
- [backend/app/routes/course_specs.py](backend/app/routes/course_specs.py)
- [backend/app/routes/roadmap.py](backend/app/routes/roadmap.py)
- [backend/app/routes/assessments.py](backend/app/routes/assessments.py)
- [backend/app/routes/progress.py](backend/app/routes/progress.py)
- [backend/app/routes/gamification.py](backend/app/routes/gamification.py)
- [backend/app/routes/notifications_sse.py](backend/app/routes/notifications_sse.py)
- [backend/app/routes/admin.py](backend/app/routes/admin.py)

### High-value backend routes

#### Auth

In [backend/app/routes/auth.py](backend/app/routes/auth.py):

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/set-password`

#### Chat / AI

In [backend/app/routes/chats.py](backend/app/routes/chats.py):

- `POST /chats/stream`: unified streaming endpoint
- `POST /chats/query`: create session + run AI pipeline atomically
- `POST /chats/{session_id}/messages`: non-streaming session message
- `GET /chats`
- `GET /chats/{session_id}`
- `PATCH /chats/{session_id}/archive`
- `DELETE /chats/{session_id}`

In [backend/app/routes/ai_query.py](backend/app/routes/ai_query.py):

- `POST /ai-query/ai-query`
- `GET /ai-query/ai-query`

These appear more like lower-level or legacy direct pipeline endpoints, while `/chats/*` is the frontend-facing workflow.

#### Ingestion

In [backend/app/routes/ingestion_router.py](backend/app/routes/ingestion_router.py):

- `POST /ingest/upload`

#### Course / academic workflow

- [backend/app/routes/courses.py](backend/app/routes/courses.py)
- [backend/app/routes/enrollments.py](backend/app/routes/enrollments.py)
- [backend/app/routes/course_specs.py](backend/app/routes/course_specs.py)
- [backend/app/routes/roadmap.py](backend/app/routes/roadmap.py)
- [backend/app/routes/assessments.py](backend/app/routes/assessments.py)
- [backend/app/routes/progress.py](backend/app/routes/progress.py)
- [backend/app/routes/gamification.py](backend/app/routes/gamification.py)
- [backend/app/routes/admin.py](backend/app/routes/admin.py)

### Service layer

Important services:

- [backend/app/services/rag_engine.py](backend/app/services/rag_engine.py): simple course-scoped retrieval from Chroma
- [backend/app/services/embedder/e5_embedder.py](backend/app/services/embedder/e5_embedder.py): E5 embedding wrapper
- [backend/app/services/bloom_detector.py](backend/app/services/bloom_detector.py): Bloom taxonomy classification
- [backend/app/services/competency_mapper.py](backend/app/services/competency_mapper.py): CBC competency similarity lookup
- [backend/app/services/prompt_engine.py](backend/app/services/prompt_engine.py): prompt assembly
- [backend/app/services/intelligent_confidence_layer.py](backend/app/services/intelligent_confidence_layer.py): LLM + heuristic gating for Bloom/CBC/RAG
- [backend/app/services/memory/memory_manager.py](backend/app/services/memory/memory_manager.py): recent-context + long-term memory summarization
- [backend/app/services/course_spec_service.py](backend/app/services/course_spec_service.py): course blueprint extraction
- [backend/app/services/roadmap_service.py](backend/app/services/roadmap_service.py): roadmap generation from approved spec
- [backend/app/services/assessment_service.py](backend/app/services/assessment_service.py): attempt lifecycle and grading workflows
- [backend/app/services/grading_ai_service.py](backend/app/services/grading_ai_service.py): AI-assisted grading suggestions
- [backend/app/services/grading_scheme_service.py](backend/app/services/grading_scheme_service.py): rubric normalization and persistence
- [backend/app/services/gamification_service.py](backend/app/services/gamification_service.py): XP/badge rules

### Database access layer

- SQLAlchemy engine/session in [backend/app/db/postgres.py](backend/app/db/postgres.py)
- ORM models in [backend/app/db/models.py](backend/app/db/models.py)
- CRUD helpers:
  - [backend/app/db/crud_chats.py](backend/app/db/crud_chats.py)
  - [backend/app/db/crud_courses.py](backend/app/db/crud_courses.py)
  - [backend/app/db/crud_users.py](backend/app/db/crud_users.py)

### Authentication / authorization flow

#### Authentication

- Password hashing and JWT creation in [backend/app/services/auth/security.py](backend/app/services/auth/security.py)
- Current user dependency in [backend/app/services/auth/deps.py](backend/app/services/auth/deps.py)
- Token subject is `user.id`
- JWT includes `role` claim in login flow

#### Authorization

- Most route protection uses role checks in:
  - [backend/app/services/auth/deps.py](backend/app/services/auth/deps.py)
  - [backend/app/services/access_control.py](backend/app/services/access_control.py)
- Domain-level checks enforce lecturer ownership of offerings and student ownership of enrollments

Important note: several functions in [backend/app/services/access_control.py](backend/app/services/access_control.py) are named `*_or_admin`, but current implementation actually only allows lecturer or student roles and does **not** grant admin bypass in those functions.

### Error handling

- Service exceptions defined in [backend/app/services/domain_errors.py](backend/app/services/domain_errors.py)
- Mapping to HTTP exceptions in [backend/app/routes/_service_errors.py](backend/app/routes/_service_errors.py)
- Some older routes still catch generic `ValueError` directly instead of using service-domain exceptions uniformly

### Logging / observability

- AI pipeline structured logger in [backend/app/services/logging/pipeline_logger.py](backend/app/services/logging/pipeline_logger.py)
- log analysis script in [backend/scripts/analyze_logs.py](backend/scripts/analyze_logs.py)
- stage timing helper `StageTimer` used in [backend/app/routes/ai_query.py](backend/app/routes/ai_query.py)
- ingestion pipeline uses `structlog`

---

## 5. Frontend Architecture

### Framework and routing

Main app shell is [frontend/react-app/src/App.tsx](frontend/react-app/src/App.tsx).

Roles route to:

- Admin: `/admin/*`
- Lecturer: `/lecturer`
- Student: `/chat`
- Public preview: `ChatPage publicMode`

### State management

- Auth context in [frontend/react-app/src/state/AuthContext.tsx](frontend/react-app/src/state/AuthContext.tsx)
- Course selection persistence in [frontend/react-app/src/state/courseStore.ts](frontend/react-app/src/state/courseStore.ts) using Zustand + `persist`
- Local component state is used heavily in `StudentWorkspace.tsx` and `LecturerWorkspacePage.tsx`

### Backend API integration

Central API wrappers live in [frontend/react-app/src/services/api.ts](frontend/react-app/src/services/api.ts).

Major client groups:

- `authApi`
- `adminApi`
- `chatApi`
- `ingestionApi`
- `courseApi`
- `offeringApi`
- `enrollmentApi`
- `progressApi`
- `assessmentApi`
- `lecturerApi`
- `institutionApi`
- `setupApi`

### Student workflow structure

Primary student UI is [frontend/react-app/src/modules/student/StudentWorkspace.tsx](frontend/react-app/src/modules/student/StudentWorkspace.tsx).

Key pieces:

- course/enrollment state via [frontend/react-app/src/modules/student/hooks/useStudentEnrollment.ts](frontend/react-app/src/modules/student/hooks/useStudentEnrollment.ts)
- chat stream via [frontend/react-app/src/hooks/useLLMStream.ts](frontend/react-app/src/hooks/useLLMStream.ts)
- markdown response rendering via [frontend/react-app/src/components/markdownMessage.tsx](frontend/react-app/src/components/markdownMessage.tsx)
- reference file upload via `ingestionApi.uploadDocument`
- roadmap/progress/gamification access via `progressApi`

### Lecturer workflow structure

Primary lecturer UI is [frontend/react-app/src/pages/LecturerWorkspacePage.tsx](frontend/react-app/src/pages/LecturerWorkspacePage.tsx).

Major lecturer areas:

- Offerings management
- Course spec extraction/review
- Roadmap builder
- Student progress views
- Assessments workspace
- Uploads
- AI assistant panel

Supporting components include:

- [frontend/react-app/src/components/lecturer/LecturerAssistantPanel.tsx](frontend/react-app/src/components/lecturer/LecturerAssistantPanel.tsx)
- [frontend/react-app/src/components/lecturer/LecturerAssessmentsWorkspace.tsx](frontend/react-app/src/components/lecturer/LecturerAssessmentsWorkspace.tsx)
- [frontend/react-app/src/components/lecturer/SpecVisualEditor.tsx](frontend/react-app/src/components/lecturer/SpecVisualEditor.tsx)

### Streaming implementation

Client SSE consumer is [frontend/react-app/src/hooks/useLLMStream.ts](frontend/react-app/src/hooks/useLLMStream.ts).

It:

- posts to `POST /chats/stream`
- parses `data:` lines from SSE
- handles session-created, token, metadata, done, and error states

### Frontend architectural inconsistencies

Several frontend services/pages reference backend endpoints or contracts that were **not found** in the current backend scan:

- `setupApi` expects `/setup/status` and `/setup/config`
- `lecturerApi` expects `/lecturers/profile`, `/lecturers/upload`, `/lecturers/uploads`, `/lecturers/stats`, `/lecturers/analytics`
- `institutionApi` expects `/institution/config`

I did **not** find matching backend routes for those paths.

Other contract mismatches:

- Frontend `TokenResponse` in [frontend/react-app/src/types/auth.ts](frontend/react-app/src/types/auth.ts) expects `user`, but backend [backend/app/routes/auth.py](backend/app/routes/auth.py) `TokenResponse` returns only `access_token` and `token_type`
- Admin RAG page expects `overview.model_config`, but backend admin route returns `rag_config`

These indicate that the frontend contains a mix of current and stale API assumptions.

### Duplicate/parallel frontend logic

- [frontend/react-app/src/modules/student/hooks/useStudentChat.ts](frontend/react-app/src/modules/student/hooks/useStudentChat.ts) appears to duplicate significant chat logic but is not referenced by the current workspace scan
- actual student page logic lives directly in [frontend/react-app/src/modules/student/StudentWorkspace.tsx](frontend/react-app/src/modules/student/StudentWorkspace.tsx)

---

## 6. Current AI / RAG Pipeline

## 6.1 Relevant AI files found

### Core query pipeline

- [backend/app/routes/ai_query.py](backend/app/routes/ai_query.py)
- [backend/app/routes/chats.py](backend/app/routes/chats.py)
- [backend/app/services/prompt_engine.py](backend/app/services/prompt_engine.py)
- [backend/app/services/intelligent_confidence_layer.py](backend/app/services/intelligent_confidence_layer.py)
- [backend/app/services/bloom_detector.py](backend/app/services/bloom_detector.py)
- [backend/app/services/competency_mapper.py](backend/app/services/competency_mapper.py)
- [backend/app/services/rag_engine.py](backend/app/services/rag_engine.py)
- [backend/app/services/memory/memory_manager.py](backend/app/services/memory/memory_manager.py)
- [backend/app/services/multiQuery.py](backend/app/services/multiQuery.py)

### LLM clients

- [backend/app/services/llm/llama_cpp_client.py](backend/app/services/llm/llama_cpp_client.py)
- [backend/app/services/llm/llama_cpp_subclient.py](backend/app/services/llm/llama_cpp_subclient.py)

### Ingestion / document processing

- [backend/app/routes/ingestion_router.py](backend/app/routes/ingestion_router.py)
- [backend/app/services/ingestion/ingestion_pipeline.py](backend/app/services/ingestion/ingestion_pipeline.py)
- [backend/app/services/ingestion/document_loader.py](backend/app/services/ingestion/document_loader.py)
- [backend/app/services/ingestion/text_chunker.py](backend/app/services/ingestion/text_chunker.py)
- [backend/app/services/ingestion/ocr_engine.py](backend/app/services/ingestion/ocr_engine.py)
- [backend/app/services/document_text_extractor.py](backend/app/services/document_text_extractor.py)

### Curriculum / course planning / academic support

- [backend/app/services/course_spec_service.py](backend/app/services/course_spec_service.py)
- [backend/app/services/roadmap_service.py](backend/app/services/roadmap_service.py)
- [backend/app/services/assessment_service.py](backend/app/services/assessment_service.py)
- [backend/app/services/grading_ai_service.py](backend/app/services/grading_ai_service.py)
- [backend/app/services/grading_scheme_service.py](backend/app/services/grading_scheme_service.py)
- [backend/app/services/progress_service.py](backend/app/services/progress_service.py)

### Evaluation / observability / tests

- [backend/app/services/logging/pipeline_logger.py](backend/app/services/logging/pipeline_logger.py)
- [backend/scripts/analyze_logs.py](backend/scripts/analyze_logs.py)
- [backend/app/tests/test_bloom_detector.py](backend/app/tests/test_bloom_detector.py)
- [backend/app/tests/test_competency_mapper.py](backend/app/tests/test_competency_mapper.py)
- [backend/app/tests/test_ingestion_pipeline.py](backend/app/tests/test_ingestion_pipeline.py)
- [backend/app/tests/test_intelligent_confidence_layer.py](backend/app/tests/test_intelligent_confidence_layer.py)
- [backend/app/tests/test_spec_extraction.py](backend/app/tests/test_spec_extraction.py)
- [backend/app/tests/profile_ai_query_pipeline.py](backend/app/tests/profile_ai_query_pipeline.py)

## 6.2 Current query pipeline, step by step

### User entrypoints

User queries currently enter through:

- `POST /chats/stream` in [backend/app/routes/chats.py](backend/app/routes/chats.py)
- `POST /chats/query` in [backend/app/routes/chats.py](backend/app/routes/chats.py)
- `POST /chats/{session_id}/messages` in [backend/app/routes/chats.py](backend/app/routes/chats.py)
- `POST /ai-query/ai-query` and `GET /ai-query/ai-query` in [backend/app/routes/ai_query.py](backend/app/routes/ai_query.py)

### Session/title handling

For new streamed or atomic chat sessions:

- title is generated by `_generate_phi_title()` in [backend/app/routes/chats.py](backend/app/routes/chats.py)
- that uses `req.app.state.llm_subclient`
- chat session is created with [backend/app/db/crud_chats.py](backend/app/db/crud_chats.py)

### Main execution path

The main pipeline is `run_ai_pipeline()` and `run_ai_pipeline_streaming()` in [backend/app/routes/ai_query.py](backend/app/routes/ai_query.py).

Execution sequence:

1. validate session and resolve `course_id` from chat session
2. log pipeline input via `PipelineLogger`
3. append user message to PostgreSQL
4. compute confidence scores using `IntelligentConfidenceLayer`
5. optionally build memory context using `MemoryManagerPG`
6. run Bloom detection if `bloom_conf > 0.4`
7. run CBC competency mapping if `cbc_conf > 0.5`
8. run RAG retrieval if `rag_conf > 0.2`
9. build final prompt via `PromptEngine.build_prompt(...)`
10. generate answer with `LLMClient`
11. store assistant message
12. maybe summarize memory into Chroma `memories`
13. return response, prompt, citations, and message id

### What data is retrieved and transformed

#### Confidence layer

In [backend/app/services/intelligent_confidence_layer.py](backend/app/services/intelligent_confidence_layer.py):

- input: raw user query
- LLM prompt asks for:
  - `bloom_conf`
  - `cbc_conf`
  - `rag_conf`
- fallback heuristics:
  - keyword-based Bloom and CBC scores
  - length-based RAG score
- output: 3 confidence scores

#### Bloom detection

In [backend/app/services/bloom_detector.py](backend/app/services/bloom_detector.py):

- input: user query
- compares embedding similarity to example phrases for Bloom levels
- output: one label such as `Remember`, `Understand`, `Apply`, etc.

#### CBC mapping

In [backend/app/services/competency_mapper.py](backend/app/services/competency_mapper.py):

- input: user query
- query embedded using shared E5 embedder
- compared against precomputed CBC embeddings from `.npy`
- output: top `Value` entries from `cbc_metadata.csv` with confidence scores

#### Retrieval

In [backend/app/services/rag_engine.py](backend/app/services/rag_engine.py):

- input: user query and resolved `course_id`
- query embedding generated via E5
- search performed against Chroma collection `course_<course_id>`
- output bundle includes:
  - `context`: formatted text block used in prompt
  - `citation`: structured metadata returned to client
  - `distance`

Retrieved metadata fields include:

- `source`
- `heading`
- `page`
- `slide`
- `content_type`
- `document_id`
- `uploader_role`
- `url` or `source_url`

### Prompt assembly

Prompt is created by [backend/app/services/prompt_engine.py](backend/app/services/prompt_engine.py).

Current prompt inputs:

- original query
- Bloom level
- competency list
- up to first 3 retrieved context chunks
- optional memory block

Notable behavior:

- prompt explicitly tells the model not to directly answer and to guide the learner
- there is **no user-role-specific prompt branching**, despite README claims of student/lecturer differentiation

### Final LLM generation

In [backend/app/services/llm/llama_cpp_client.py](backend/app/services/llm/llama_cpp_client.py):

- final model uses Gemma-family GGUF path from config
- sync generation uses `create_chat_completion`
- streaming generation uses raw completion mode

Important limitation:

- `generate_stream_async()` currently collects **all** streamed tokens in a list inside a thread pool before yielding them back to the async caller
- this means the current "streaming" path is likely **pseudo-streaming** rather than true token-by-token backend streaming

### Memory pipeline

In [backend/app/services/memory/memory_manager.py](backend/app/services/memory/memory_manager.py):

- recent short-term context comes from PostgreSQL `chat_messages`
- long-term memory retrieval comes from Chroma collection `memories`
- summarization uses `LLMSubclient` after message-count threshold
- summaries are embedded and stored back into Chroma

This is the closest existing subsystem to hierarchical summarization, but it is only chat-memory summarization, not document hierarchy or course-knowledge hierarchy.

## 6.3 Ingestion pipeline, step by step

Main path is [backend/app/services/ingestion/ingestion_pipeline.py](backend/app/services/ingestion/ingestion_pipeline.py).

Sequence:

1. upload arrives at `POST /ingest/upload`
2. file is saved under `data/uploads/<course_id>/`
3. `metadata_store.get_or_create_document(...)` registers or deduplicates document row
4. `DocumentLoader.load(...)` extracts text and images
5. `SemanticChunker.chunk(...)` creates structure-aware chunks
6. E5 embedder produces passage embeddings
7. chunks are upserted into Chroma course collection
8. OCR is attempted for extracted images
9. OCR currently returns `pending`, so image text is not actually added
10. ingestion result and counts are returned to API caller

### What is stored during ingestion

#### PostgreSQL

`IngestedDocument` row in [backend/app/db/models.py](backend/app/db/models.py):

- stable `document_id`
- `course_id`
- `uploader_user_id`
- filename/hash/mime/storage path
- status
- counts for chunks, vectors, OCR

#### Chroma metadata per chunk

Typical metadata includes:

- `source`
- `document_id`
- `course_id`
- `uploader_user_id`
- `uploader_role`
- `content_type`
- `chunk_index`
- optional `page`, `slide`, `heading`
- optional `char_start`, `char_end`

### Course-spec extraction pipeline

Separate but related path in [backend/app/services/course_spec_service.py](backend/app/services/course_spec_service.py):

1. lecturer uploads a PDF or DOCX for a course offering
2. raw text is extracted using [backend/app/services/document_text_extractor.py](backend/app/services/document_text_extractor.py)
3. document is stored under `docs/<COURSE>/<offering_id>/`
4. document is registered in `IngestedDocument`
5. final LLM extracts canonical JSON with:
   - `course_header`
   - `learning_outcomes`
   - `competencies`
   - `assessment_plan`
   - `roadmap_items`
6. fallback skeleton spec is created if extraction fails
7. roadmap draft can be generated from extracted `roadmap_items`

This is valuable for HA-RAG because it already produces structured course context from documents.

## 6.4 Confidence scoring, validation, fallback, logging

### Confidence scoring

- Implemented in [backend/app/services/intelligent_confidence_layer.py](backend/app/services/intelligent_confidence_layer.py)
- uses LLM-first, heuristic fallback, weighted fusion
- gates Bloom/CBC/RAG execution

### Validation

- Pydantic request/response models in `backend/app/models/*`
- service-level validation via `ServiceValidationError`
- spec extraction validates top-level JSON structure using `_validate_spec_json(...)`
- grading services validate component weights and rubric structure

### Fallback logic

- `LLMClient` and `LLMSubclient` both fall back from GPU to CPU if model init fails
- ICL falls back to heuristics if LLM JSON parsing fails
- course-spec extraction falls back to skeleton spec if extraction fails
- OCR is stubbed as `pending`

### Logging

- `PipelineLogger` records:
  - input
  - ICL confidence
  - Bloom detection
  - CBC mapping
  - RAG retrieval
  - prompt construction
  - LLM output
  - final response
  - errors
- logs are written to JSONL
- `backend/scripts/analyze_logs.py` can analyze latency, gating rates, and score distributions

### Citation / evidence tracking

- citations are returned to clients from `RAGEngine.retrieve_bundle(...)`
- they include document id, source, snippet, content type, page/slide
- citations are **not used to ground answer generation in a structured way**
- no evidence scoring or citation verification layer was found

---

## 7. Data Layer Analysis

### Database type

- Primary relational DB: PostgreSQL
- Vector DB: Chroma persistent storage in `data/chroma_db`
- Legacy file: `data/chat_memory.sqlite`

### ORM entities

Key tables in [backend/app/db/models.py](backend/app/db/models.py):

#### Auth and users

- `User`
- `UserProfile`
- `AuthSession`

#### Chat and memory

- `ChatSession`
- `ChatMessage`
- `MemoryState`

#### Course / curriculum / enrollment

- `Course`
- `CourseOffering`
- `Enrollment`
- `EnrollmentEvent`
- `IngestedDocument`
- `OfferingCourseSpec`
- `OfferingRoadmapItem`
- `RoadmapAssessmentTask`

#### Student progress / assessment / grading

- `EnrollmentRoadmapProgress`
- `EnrollmentTaskResult`
- `GradingTemplate`
- `GradingTemplateVersion`
- `GradingTemplateComponent`
- `GradingTemplateRubricLevel`
- `TaskGradingSchemeVersion`
- `TaskGradingComponent`
- `TaskComponentRubricLevel`
- `AttemptAiEvaluation`
- `AttemptAiComponentSuggestion`
- `AttemptComponentScore`

#### Admin / institution

- `InstitutionSettings`
- `Faculty`
- `Department`

#### Notifications / gamification

- `Notification`
- `NotificationTemplate`
- `NotificationPreference`
- `StudentGamificationProfile`
- `StudentBadge`
- `XpEvent`

### Relationships

Important data relationships:

- `Course` -> many `CourseOffering`
- `CourseOffering` -> many `Enrollment`
- `CourseOffering` -> many `OfferingCourseSpec`
- `CourseOffering` -> many `OfferingRoadmapItem`
- `OfferingRoadmapItem` -> many `RoadmapAssessmentTask`
- `Enrollment` -> many `EnrollmentRoadmapProgress`
- `Enrollment` -> many `EnrollmentTaskResult`
- `EnrollmentTaskResult` -> many `AttemptAiEvaluation`
- `TaskGradingSchemeVersion` -> many `TaskGradingComponent`
- `TaskGradingComponent` -> many rubric levels and AI/manual component scores

### Curriculum / course / content representation

The repository already represents curriculum/course knowledge at multiple levels:

- `Course`: canonical course code/name
- `CourseOffering`: term/cohort/section/lecturer-bound instance
- `IngestedDocument`: uploaded content tied to course code
- `OfferingCourseSpec.spec_json`: structured blueprint data extracted from source doc
- `OfferingRoadmapItem`: weekly or sequence-based teaching plan
- `RoadmapAssessmentTask`: assessment tasks linked to roadmap item

This is highly relevant for HA-RAG because it gives existing academic structure beyond plain chunk retrieval.

### Migrations and SQL artifacts

Found migration/schema artifacts:

- [backend/alembic/versions/47bf113d1142_initial_migration.py](backend/alembic/versions/47bf113d1142_initial_migration.py)
- [backend/alembic/versions/9bd94f83f34c_admin_governance_foundation.py](backend/alembic/versions/9bd94f83f34c_admin_governance_foundation.py)
- [backend/app/db/maindb.sql](backend/app/db/maindb.sql)
- [backend/app/db/migration_full.sql](backend/app/db/migration_full.sql)
- [backend/app/db/added_tables](backend/app/db/added_tables)
- [backend/scripts/apply_grading_migration.py](backend/scripts/apply_grading_migration.py)

Observation: schema evolution is split between Alembic, raw SQL, and manual helper scripts.

### Seed / sample data

Sample or test content found:

- uploaded documents in `data/uploads/`
- sample docs in `docs/BIO1101`, `docs/CS102`, `docs/SWE3202`
- notification template seed script in [scripts/seed_notification_templates.py](scripts/seed_notification_templates.py)

### Vector / embedding storage

- Chroma persistent DB under `data/chroma_db`
- one collection per course, named by `VectorStore.course_collection_name(course_id)`
- separate `memories` collection for long-term chat memory

### Not found in current data model

- entity tables for extracted concepts/topics/skills
- graph or edge table for topic relationships
- summary tree / parent-child chunk hierarchy tables
- retrieval feedback or evaluation result tables
- source citation acceptance/rejection audit tables

---

## 8. HA-RAG Readiness Assessment

Legend:

- `Yes`: present in meaningful form
- `Partial`: present but incomplete or simplistic
- `No`: not found in current repository scan

| Capability | Status | Notes |
|---|---|---|
| Document ingestion | Yes | [backend/app/services/ingestion/ingestion_pipeline.py](backend/app/services/ingestion/ingestion_pipeline.py) |
| Chunking | Yes | Structure-aware chunking in [backend/app/services/ingestion/text_chunker.py](backend/app/services/ingestion/text_chunker.py) |
| Embedding generation | Yes | E5 embedder in [backend/app/services/embedder/e5_embedder.py](backend/app/services/embedder/e5_embedder.py) |
| Vector search | Yes | Chroma query in [backend/app/db/vector_store.py](backend/app/db/vector_store.py) |
| Course-scoped retrieval | Yes | `course_<course_id>` collections in [backend/app/services/rag_engine.py](backend/app/services/rag_engine.py) |
| Curriculum-aware retrieval | Partial | CBC mapping exists, but retrieval itself does not filter/rank by competencies |
| Entity extraction | No | Not found in current repository scan |
| Relationship extraction | No | Not found in current repository scan |
| Table-based relationship lookup | Partial | relational course/roadmap/assessment data exists, but not retrieval-oriented entity tables |
| Summary generation | Partial | chat memory summarization exists; document hierarchy summarization does not |
| Hierarchical summaries | No | not for documents/courses; only flat memory summaries |
| Adaptive query routing | Partial | ICL gates modules, but no router among retrieval strategies |
| Context ranking / reranking | Partial | Chroma distance ordering only; no reranker |
| Multi-query expansion | Partial | service exists in [backend/app/services/multiQuery.py](backend/app/services/multiQuery.py) but is not used in main pipeline |
| Prompt assembly | Yes | [backend/app/services/prompt_engine.py](backend/app/services/prompt_engine.py) |
| Grounded answer generation | Partial | context is injected, but no strict citation-grounding enforcement |
| Source citation / evidence tracking | Partial | citations returned to client; no evidence attribution loop |
| Evaluation metrics | Partial | pipeline logs and tests exist; no formal HA-RAG eval suite |
| OCR-based scanned document ingestion | No | current OCR engine is placeholder returning `pending` |
| Offerings/course hierarchy usable for scoped retrieval | Partial | offering/spec/roadmap structure exists but vector retrieval is course-code scoped, not offering scoped |

### Overall HA-RAG readiness

The repository is ready for **Phase 1 HA-RAG foundation work**:

- hierarchical indexing metadata
- improved retrieval orchestration
- structured academic context fusion
- better evidence packaging

It is **not** ready for full HA-RAG without adding:

- hierarchical storage model
- richer metadata extraction
- entity/relationship index
- retrieval planner/router
- grounding/evaluation layer

---

## 9. Gaps and Risks

## 9.1 Missing components

- No entity extraction pipeline
- No concept/relationship graph
- No hierarchical chunk tree or summary tree
- No adaptive retrieval planner
- No reranking model
- No offering-level or section-level vector scoping
- No scanned-PDF OCR implementation
- No retrieval evaluation benchmark harness
- No explicit answer-grounding verifier

## 9.2 Duplicated or weak abstractions

- Student chat logic is duplicated between [frontend/react-app/src/modules/student/StudentWorkspace.tsx](frontend/react-app/src/modules/student/StudentWorkspace.tsx) and [frontend/react-app/src/modules/student/hooks/useStudentChat.ts](frontend/react-app/src/modules/student/hooks/useStudentChat.ts)
- Route conventions are mixed:
  - most routes are root-prefixed like `/auth`, `/chats`, `/courses`
  - admin uses `/api/admin`
  - README still documents `/api/ai/*` and `/api/ingest/*`
- Schema management is fragmented between Alembic, raw SQL files, and manual scripts

## 9.3 Security issues

- [backend/app/routes/notifications_sse.py](backend/app/routes/notifications_sse.py) exposes `/notifications/stream/{user_id}` without auth dependency
- [backend/app/core/config.py](backend/app/core/config.py) contains insecure default `SECRET_KEY` placeholder
- chat session creation can auto-create placeholder courses in [backend/app/db/crud_chats.py](backend/app/db/crud_chats.py), which may allow uncontrolled course-table pollution
- query responses include full `prompt` in [backend/app/models/schemas.py](backend/app/models/schemas.py), which may leak internal instructions/context to clients

## 9.4 Scalability issues

- App startup eagerly loads:
  - final LLM
  - subclient LLM
  - E5 embedder
  - Bloom detector model
- Chroma collection-per-course strategy may become unwieldy at larger institutional scale
- retrieval is single-query, single-vector, no batching or reranking
- `generate_stream_async()` is not true incremental async streaming
- no queue/offload around ingestion besides threadpool wrapping

## 9.5 Maintainability issues

- README/docs are partially stale relative to code
- frontend references non-existent endpoints and mismatched response shapes
- [backend/app/services/notification/service.py](backend/app/services/notification/service.py) appears malformed and likely syntactically invalid due to inconsistent indentation
- requirements file appears missing runtime dependencies actually imported by code
- notification/event-bus subsystem is incomplete and probably nonfunctional without extra packages

## 9.6 Areas likely to break if HA-RAG is added carelessly

- [backend/app/routes/ai_query.py](backend/app/routes/ai_query.py): central orchestration, citations, logging, and streaming behavior
- [backend/app/services/prompt_engine.py](backend/app/services/prompt_engine.py): currently simple and shared across student/lecturer contexts
- [backend/app/db/vector_store.py](backend/app/db/vector_store.py): collection naming, metadata, and query contract are used by both RAG and memory subsystems
- [backend/app/services/ingestion/ingestion_pipeline.py](backend/app/services/ingestion/ingestion_pipeline.py): any metadata/schema changes affect retrieval and document registry
- [backend/app/services/course_spec_service.py](backend/app/services/course_spec_service.py): already builds structured course context and should be extended carefully

---

## 10. Implementation Readiness Report

## 10.1 Current architecture summary

The platform already has three relevant knowledge layers:

1. unstructured course documents in Chroma
2. structured course blueprint JSON in `OfferingCourseSpec.spec_json`
3. structured delivery/assessment workflow in roadmap and grading tables

This is a strong basis for HA-RAG because you do not need to start from raw PDFs alone.

## 10.2 Recommended HA-RAG integration points

### 1. Retrieval orchestration

- [backend/app/services/rag_engine.py](backend/app/services/rag_engine.py)
- likely expand into multiple retrieval modes:
  - chunk retrieval
  - spec retrieval
  - roadmap retrieval
  - assessment retrieval
  - memory retrieval

### 2. Query pipeline orchestration

- [backend/app/routes/ai_query.py](backend/app/routes/ai_query.py)
- add adaptive query routing and evidence packaging here, or move orchestration into a dedicated pipeline service

### 3. Ingestion and indexing

- [backend/app/services/ingestion/ingestion_pipeline.py](backend/app/services/ingestion/ingestion_pipeline.py)
- add hierarchical chunk metadata, summaries, document structure ids, topic/entity extraction hooks

### 4. Relational context fusion

- [backend/app/services/course_spec_service.py](backend/app/services/course_spec_service.py)
- [backend/app/services/roadmap_service.py](backend/app/services/roadmap_service.py)
- [backend/app/services/progress_service.py](backend/app/services/progress_service.py)

These already encode academic hierarchy and should feed HA-RAG retrieval/ranking.

### 5. Storage and models

- [backend/app/db/models.py](backend/app/db/models.py)
- [backend/app/db/vector_store.py](backend/app/db/vector_store.py)

You will likely need new tables and richer vector metadata to represent document sections, summaries, entities, and relationships.

## 10.3 Recommended implementation plan

### Phase 1: Stabilize contracts before HA-RAG

- normalize API contracts and route naming
- fix frontend/backend auth mismatch
- decide whether `/chats/*` or `/ai-query/*` is canonical
- fix missing dependency declarations
- identify dead/stale frontend pages and empty Electron shell

### Phase 2: Extend ingestion for HA-RAG indexing

- preserve document hierarchy during chunking
- add section ids, parent ids, heading lineage, offering id, spec linkage
- generate summary chunks at document, section, and course levels
- optionally extract entities/topics/CLO links during ingestion

### Phase 3: Add structured retrieval layer

- create retrieval over:
  - raw chunks
  - document summaries
  - course specs
  - roadmap items
  - assessment tasks
- support scoped retrieval by:
  - course code
  - offering id
  - lecturer/student role
  - content type

### Phase 4: Add adaptive query router

- classify query intent:
  - conceptual explanation
  - course policy/spec lookup
  - roadmap/progress question
  - assessment/grading question
  - cross-document content question
- route to appropriate retrievers before prompt assembly

### Phase 5: Add evidence assembly and grounded generation

- return evidence bundles with source metadata
- add citation-aware prompt templates
- preserve traceability from answer sentence -> chunk/spec/task if desired

### Phase 6: Add evaluation and monitoring

- retrieval recall/precision sampling
- answer grounding checks
- latency metrics by retriever mode
- failure analysis on empty/low-confidence retrieval

## 10.4 Files likely to need modification

### Highest priority

- `backend/app/routes/ai_query.py`
- `backend/app/services/rag_engine.py`
- `backend/app/services/prompt_engine.py`
- `backend/app/services/ingestion/ingestion_pipeline.py`
- `backend/app/services/ingestion/text_chunker.py`
- `backend/app/db/vector_store.py`
- `backend/app/db/models.py`
- `backend/app/services/course_spec_service.py`
- `backend/app/services/memory/memory_manager.py`
- `frontend/react-app/src/hooks/useLLMStream.ts`
- `frontend/react-app/src/modules/student/StudentWorkspace.tsx`
- `frontend/react-app/src/components/lecturer/LecturerAssistantPanel.tsx`

### Likely supporting changes

- `backend/app/models/schemas.py`
- `backend/app/models/roadmap_schemas.py`
- `backend/app/routes/admin.py`
- `frontend/react-app/src/services/api.ts`
- `frontend/react-app/src/pages/AdminRagMonitoringPage.tsx`

## 10.5 Files/modules that should not be touched in the first HA-RAG iteration

These are not absolutely untouchable forever, but they should be avoided unless required:

- existing Alembic migration files under `backend/alembic/versions/`
- auth internals in `backend/app/services/auth/` unless fixing auth contract bugs
- grading/gamification services unless HA-RAG is explicitly extending assessment workflows
- generated assets:
  - `frontend/react-app/node_modules/`
  - `frontend/react-app/dist/`
  - `frontend/react-app/.vite/`
- sample uploaded data under `data/uploads/` and `docs/<COURSE>/`

## 10.6 Suggested new files/modules

- `backend/app/services/harag/query_router.py`
- `backend/app/services/harag/retrieval_orchestrator.py`
- `backend/app/services/harag/context_ranker.py`
- `backend/app/services/harag/prompt_assembler.py`
- `backend/app/services/harag/evidence_packager.py`
- `backend/app/services/harag/summary_indexer.py`
- `backend/app/services/harag/entity_extractor.py`
- `backend/app/services/harag/relationship_extractor.py`
- `backend/app/services/harag/evaluator.py`
- `backend/app/db/crud_harag.py`
- new Pydantic schemas for retrieval traces and evidence bundles

Possible new DB tables:

- `document_sections`
- `document_section_summaries`
- `document_entities`
- `document_relationships`
- `retrieval_runs`
- `retrieval_evaluations`

---

## 11. Important Findings and Mismatches

### Branch mismatch

- branch name says `feature/harag`
- code state looks like streaming-first/dev baseline

### API contract mismatches

- auth login response mismatch
- admin RAG response key mismatch
- several frontend endpoints not backed by routes

### README/documentation drift

- README route prefixes do not match actual backend route prefixes
- `docs/INGESTION_GUIDE.md` references outdated paths like `routes/ingestion.py` and a non-current embedding service

### Runtime/dependency risk

- code imports `jose`, `redis`, and `rq`, but the packages were not found in `backend/requirements.txt`

### Notification subsystem risk

- [backend/app/services/notification/service.py](backend/app/services/notification/service.py) appears structurally broken
- notification/event bus stack is incomplete and likely not a stable extension point for HA-RAG work

### Streaming caveat

- current backend "streaming" implementation likely buffers full token list before async emission

### Role-awareness gap

- README claims role-aware prompting
- actual prompt engine does not branch by role

### Multi-query not integrated

- `MultiQuery` service exists and is initialized in `app.state`
- main query pipeline does not use it

---

## 12. Open Questions for the Project Owner

1. Should HA-RAG retrieval be scoped by `course_code`, `course_offering_id`, or both?
2. Should lecturer-uploaded content be isolated by offering/semester, or shared across all offerings of the same course?
3. Is `OfferingCourseSpec.spec_json` intended to become a first-class knowledge source for student answers, or only a lecturer planning artifact?
4. Do you want HA-RAG to answer only from lecturer/course documents, or also from curriculum/CBC reference data and roadmap/spec data?
5. What citation granularity do you want:
   - document-level
   - page/slide-level
   - chunk-level
   - section/heading-level
6. Should the system support scanned PDFs and images as first-class sources soon, or can OCR remain deferred?
7. Should HA-RAG support student-specific personalization using:
   - enrollment progress
   - past chat memory
   - roadmap status
   - past assessment attempts
8. Is the intended canonical API surface `/chats/*` or `/ai-query/*`?
9. Should the HA-RAG system stay fully local/offline, or may it use external APIs later for extraction/reranking/evaluation?
10. Do you want formal evaluation datasets and metrics as part of the implementation, or only functional integration first?

---

## Final Assessment

This repository already contains the ingredients for a meaningful academic HA-RAG system:

- local LLM inference
- embeddings
- vector retrieval
- structured academic/course data
- course-spec extraction
- roadmap/assessment context
- chat memory
- logging and diagnostic tests

However, the current RAG layer is still a **single-stage course-chunk retriever** with basic prompt stuffing. To reach HA-RAG, the next implementation should focus on:

- hierarchical indexing
- structured academic context retrieval
- adaptive routing
- evidence packaging
- evaluation and contract cleanup

The safest approach is evolutionary: extend the existing ingestion, vector, spec, roadmap, and query pipeline modules rather than replacing them wholesale.
