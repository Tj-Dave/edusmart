# EduSmart University Prototype Deployment

## Overview

This deployment plan packages EduSmart as a single-server prototype for a university environment. It keeps the current backend and frontend architecture intact, adds the missing deployment scaffolding, and avoids changing the existing APIs or grading logic.

The recommended prototype topology is:

- `Nginx` serves the React frontend build
- `Nginx` reverse-proxies API requests to FastAPI on `127.0.0.1:8000`
- `PostgreSQL` stores transactional data
- `ChromaDB` persists embeddings in `data/chroma_db`
- local GGUF models are stored under `models/`

For the current codebase, run a single backend worker. This is important because:

- the LLMs are loaded in-process at startup
- SSE notifications are process-local today

## Minimum Server Requirements

For a university prototype:

- Ubuntu 22.04 or 24.04
- Python 3.11 or 3.12
- Node.js 20.x
- PostgreSQL 15+
- Nginx
- `build-essential`, `cmake`, `pkg-config`, `python3-dev`, `libpq-dev`
- 8 vCPU
- 32 GB RAM
- 100 GB SSD

Optional:

- NVIDIA GPU if you want better local inference latency

## Runtime Dependencies

Backend runtime packages are listed in [requirements-server.txt](/home/raven/EduSmart/edusmart/backend/requirements-server.txt).

Frontend dependencies are already declared in [package.json](/home/raven/EduSmart/edusmart/frontend/react-app/package.json).

## Files Added for Deployment

- backend env template: [backend/.env.example](/home/raven/EduSmart/edusmart/backend/.env.example)
- frontend production env template: [frontend/react-app/.env.production.example](/home/raven/EduSmart/edusmart/frontend/react-app/.env.production.example)
- systemd unit: [deployment/systemd/edusmart-backend.service](/home/raven/EduSmart/edusmart/deployment/systemd/edusmart-backend.service)
- nginx site config: [deployment/nginx/edusmart-university-prototype.conf](/home/raven/EduSmart/edusmart/deployment/nginx/edusmart-university-prototype.conf)
- bootstrap script: [deployment/scripts/bootstrap_university_prototype.sh](/home/raven/EduSmart/edusmart/deployment/scripts/bootstrap_university_prototype.sh)
- packaging script: [deployment/scripts/build_deployment_bundle.sh](/home/raven/EduSmart/edusmart/deployment/scripts/build_deployment_bundle.sh)

## Code Fixes Included

The deployment prep also includes a few portability fixes:

- backend CORS now comes from `CORS_ORIGINS` instead of being hardcoded
- Chroma, uploads, and course-spec storage now use env-resolved paths
- Alembic now reads `DATABASE_URL` from `backend/.env`
- the grading migration script now runs each SQL file inside a transaction
- frontend API calls can default to same-origin in production instead of `http://localhost:8000`
- notifications now use the shared API base URL, and the missing `PATCH /notifications/{id}/read` endpoint is available

## Packaging Strategy

Package the system in four parts:

1. App bundle
2. Model bundle
3. Database backup
4. Runtime data backup

### 1. App Bundle

Build a deployable source bundle with:

```bash
bash deployment/scripts/build_deployment_bundle.sh
```

Optional:

```bash
bash deployment/scripts/build_deployment_bundle.sh --include-models --include-runtime-data
```

That produces a tarball under `deployment/artifacts/`.

### 2. Model Bundle

The `models/` directory is large and should usually be shipped separately:

- `Phi-3-mini-4k-instruct-q4.gguf`
- `gemma-3-4b-pt-q4_0.gguf`
- `gemma-3n-q4_k_m.gguf`

If the server is offline, also pre-cache the Hugging Face embedding models used by:

- `intfloat/e5-base-v2`
- `all-MiniLM-L6-v2`

### 3. Database Backup

Use PostgreSQL tools such as:

```bash
pg_dump -Fc "$DATABASE_URL" > edusmart-db.dump
```

### 4. Runtime Data Backup

Preserve these directories when moving environments:

- `data/chroma_db`
- `data/uploads`
- `docs/`

If you move an existing prototype, keep the install path stable when possible, for example:

```text
/opt/edusmart/current
```

That keeps path-based references predictable.

## First-Time Server Setup

### 1. Copy the project to the target server

Suggested layout:

```text
/opt/edusmart/current
```

### 2. Create backend env

Start from:

- [backend/.env.example](/home/raven/EduSmart/edusmart/backend/.env.example)

Required values:

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `CORS_ORIGINS`
- model paths if you store models outside the repo

For frontend builds on a dedicated frontend hostname, set:

- [frontend/react-app/.env.production.example](/home/raven/EduSmart/edusmart/frontend/react-app/.env.production.example)

If you deploy same-origin behind Nginx, `VITE_API_URL` is optional because the frontend now falls back to the current origin in production.

### 3. Bootstrap the app

Run:

```bash
bash deployment/scripts/bootstrap_university_prototype.sh
```

That script:

- creates `backend/.venv`
- installs backend runtime dependencies
- creates runtime directories
- applies the PostgreSQL migration script
- installs frontend dependencies
- builds the React frontend

### 4. Install the backend service

Copy and edit:

- [deployment/systemd/edusmart-backend.service](/home/raven/EduSmart/edusmart/deployment/systemd/edusmart-backend.service)

Then:

```bash
sudo cp deployment/systemd/edusmart-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now edusmart-backend
```

### 5. Install the Nginx site

Copy and edit:

- [deployment/nginx/edusmart-university-prototype.conf](/home/raven/EduSmart/edusmart/deployment/nginx/edusmart-university-prototype.conf)

Then:

```bash
sudo cp deployment/nginx/edusmart-university-prototype.conf /etc/nginx/sites-available/edusmart
sudo ln -s /etc/nginx/sites-available/edusmart /etc/nginx/sites-enabled/edusmart
sudo nginx -t
sudo systemctl reload nginx
```

Add TLS with Certbot or your university reverse proxy after the site is reachable.

## Database and Schema Management

For the current prototype, the safest schema path is:

```bash
cd backend
python3 scripts/apply_grading_migration.py
```

Dry run:

```bash
cd backend
python3 scripts/apply_grading_migration.py --dry-run
```

Alembic is now wired to `DATABASE_URL`, but the grading SQL runner remains the primary operational path for this deployment because it matches the current schema files directly.

## Operational Notes

- Run one backend worker only
- disable proxy buffering for SSE
- keep `models/`, `data/`, and Postgres on persistent storage
- back up PostgreSQL and `data/chroma_db` together
- if the server has no outbound internet, pre-stage the embedding model cache

## Verification Checklist

After deployment, verify:

1. `GET /health` returns `{"status":"ok"}`
2. `GET /db-health` succeeds
3. login works from the frontend
4. chat loads on the deployed domain
5. roadmap and assessments load for a student
6. lecturer assessments load
7. SSE notifications connect without proxy buffering issues

## Recommended Next Step

After the prototype is stable on the university server, the next worthwhile hardening step is a Docker or Compose deployment so the Python, Node build, Postgres, and model/runtime layout become repeatable across environments.
