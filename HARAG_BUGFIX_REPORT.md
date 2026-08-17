# HA-RAG Bugfix Report

## Responsible files inspected first
- `backend/app/models/admin_schemas.py`: failing Pydantic schema area; `model_config` is reserved in Pydantic v2.
- `backend/app/routes/ai_query.py`: `/chats/*` delegates into this pipeline; streaming path used `harag_retriever` without defining it.
- `backend/app/main.py`: owns the `app.state.harag_retriever` singleton.
- `frontend/react-app/src/modules/student/StudentWorkspace.tsx`: chat message rendering path that surfaced the DOM nesting warning.
- `frontend/react-app/src/components/markdownMessage.tsx`: markdown renderer used inside chat bubbles; paragraph rendering could contain block children.
- `backend/alembic/env.py` and `backend/alembic/versions/e5d42f1b7c61_harag_v1_pgvector.py`: migration/model registration readiness.

## Bug 1: Pydantic schema startup failure
Root cause: `RAGMonitoringOverviewOut` needed to expose a `model_config` response key, but `model_config` is reserved by Pydantic v2 for model configuration. Declaring it as a normal field causes Pydantic to treat a `FieldInfo` as config data, producing `TypeError: 'FieldInfo' object is not iterable`.

Fix:
- Updated `backend/app/models/admin_schemas.py`.
- Added `ConfigDict(populate_by_name=True)`.
- Replaced the unsafe field with `model_config_data: dict[str, Any] = Field(..., alias="model_config")`.

## Bug 2: `harag_retriever` undefined
Root cause: `run_ai_pipeline_streaming()` referenced `harag_retriever` later in the RAG stage, but only the non-streaming path had initialized it. The non-streaming path also had duplicate assignments.

Fix:
- Updated `backend/app/routes/ai_query.py`.
- Removed duplicate non-streaming initialization.
- Added `harag_retriever = getattr(req.app.state, "harag_retriever", None)` to the streaming path.
- Added `dev_mode = _dev_mode_enabled(req)` to the streaming path, since that path also used it.
- Confirmed the canonical service remains `app.state.harag_retriever`, initialized in `backend/app/main.py`.

## Bug 3: Invalid React DOM nesting
Root cause: `ReactMarkdown` rendered paragraphs as `<p>`. Markdown content can include block children, and in the chat bubble/dev evidence path that can lead to invalid `<div>` descendants inside `<p>`.

Fix:
- Updated `frontend/react-app/src/components/markdownMessage.tsx`.
- Changed markdown paragraph rendering from `<p>` to a styled `<div>`.
- This keeps the same visual styling while allowing block content safely.

## Migration readiness
Checked:
- `backend/alembic/env.py` imports `app.db.models`, so HA-RAG SQLAlchemy models are included in `Base.metadata`.
- HA-RAG tables are present in `backend/app/db/models.py`.
- Migration file `e5d42f1b7c61_harag_v1_pgvector.py` creates the pgvector extension and HA-RAG tables.

Known migration cautions:
- PostgreSQL must have pgvector available, because the migration runs `CREATE EXTENSION IF NOT EXISTS vector`.
- `backend/alembic.ini` contains a placeholder `sqlalchemy.url`; use a real database URL before running migrations.
- Run migrations only after confirming the database is backed up or disposable.

Safe migration command:
```bash
cd backend
DATABASE_URL='postgresql+psycopg2://USER:PASSWORD@HOST:PORT/DBNAME' alembic upgrade head
```

## Validation performed
- Python AST validation passed for backend models, HA-RAG services, routes, `app.main`, Alembic env, and the HA-RAG migration.
- `git diff --check` passed.
- Frontend build passed with `npm run build`.
- Reference sweep confirmed all `harag_retriever` uses now resolve to the `app.state.harag_retriever` singleton.
- Reference sweep found no remaining unsafe Pydantic `model_config` field declaration.

## Validation limitations
- Direct backend imports and `uvicorn app.main:app` could not be run in this shell because the active Python environment has no installed backend dependencies: `pydantic`, `sqlalchemy`, `fastapi`, `pytest`, and even `pip` are unavailable for `/usr/bin/python3`.
- Because of that environment limitation, import/startup validation should be rerun in the project’s backend environment after dependencies are installed.

Recommended backend validation commands once dependencies are available:
```bash
cd /home/raven/EduSmart/edusmart
PYTHONPATH=backend python -c "import app.models.admin_schemas; print('admin schemas ok')"
PYTHONPATH=backend python -c "import app.main; print('main import ok')"
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000
pytest app/tests/test_harag_v1.py -q
```

## Remaining known issues
- Backend runtime validation still depends on installing/activating the repository’s Python environment.
- `backend/alembic.ini` should be updated or overridden with a valid database URL before migration execution.
