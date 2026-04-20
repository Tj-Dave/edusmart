#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/deployment/artifacts"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
APP_BUNDLE="$ARTIFACTS_DIR/edusmart-app-$TIMESTAMP.tar.gz"
INCLUDE_MODELS=0
INCLUDE_RUNTIME_DATA=0

for arg in "$@"; do
  case "$arg" in
    --include-models)
      INCLUDE_MODELS=1
      ;;
    --include-runtime-data)
      INCLUDE_RUNTIME_DATA=1
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$ARTIFACTS_DIR"

TAR_ARGS=(
  --exclude=.git
  --exclude=.codex
  --exclude=.pytest_cache
  --exclude=backend/.env
  --exclude=backend/.venv
  --exclude=frontend/react-app/node_modules
  --exclude=frontend/react-app/.vite
  --exclude=deployment/artifacts
  --exclude=__pycache__
  --exclude=*.pyc
)

INCLUDES=(
  README.md
  backend
  frontend/react-app
  deployment
  docs/deployment
  scripts
)

if [[ "$INCLUDE_MODELS" -eq 1 ]]; then
  INCLUDES+=(models)
fi

if [[ "$INCLUDE_RUNTIME_DATA" -eq 1 ]]; then
  INCLUDES+=(data docs/BIO1101 docs/CS102)
fi

cd "$ROOT_DIR"
tar -czf "$APP_BUNDLE" "${TAR_ARGS[@]}" "${INCLUDES[@]}"

echo "Created deployment bundle:"
echo "  $APP_BUNDLE"
