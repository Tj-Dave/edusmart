#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend/react-app"
VENV_DIR="$BACKEND_DIR/.venv"

echo "[1/6] Preparing backend virtual environment"
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip setuptools wheel
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements-server.txt"

echo "[2/6] Ensuring runtime directories exist"
mkdir -p \
  "$ROOT_DIR/data/chroma_db" \
  "$ROOT_DIR/data/uploads" \
  "$ROOT_DIR/data/curriculum_docs" \
  "$ROOT_DIR/data/lecturer_uploads" \
  "$ROOT_DIR/data/raw_images" \
  "$ROOT_DIR/data/embeddings" \
  "$ROOT_DIR/docs" \
  "$ROOT_DIR/logs"

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  echo "backend/.env is missing. Copy backend/.env.example to backend/.env and fill in DATABASE_URL / JWT_SECRET_KEY first."
  exit 1
fi

echo "[3/6] Applying PostgreSQL schema updates"
"$VENV_DIR/bin/python" "$BACKEND_DIR/scripts/apply_grading_migration.py"

echo "[4/6] Installing frontend dependencies"
cd "$FRONTEND_DIR"
npm ci

echo "[5/6] Building frontend bundle"
npm run build

echo "[6/6] Bootstrap complete"
cat <<'EOF'

Next steps:
1. Copy deployment/systemd/edusmart-backend.service to /etc/systemd/system/
2. Copy deployment/nginx/edusmart-university-prototype.conf to /etc/nginx/sites-available/
3. Update the domain, service user, and install paths in those files
4. Enable the systemd service and nginx site
5. Provision HTTPS with Certbot or your university reverse proxy

EOF
