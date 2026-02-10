#!/bin/bash

# EduSmart Production Server Startup Script
# This script starts the FastAPI backend server with proper configuration

echo "🚀 Starting EduSmart Backend Server..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Initialize conda
# shellcheck disable=SC1091
source "$(conda info --base)/etc/profile.d/conda.sh"

# Activate conda environment
CONDA_ENV="edusmart"
if conda env list | grep -q "^${CONDA_ENV}"; then
    echo -e "${YELLOW}🔄 Activating conda environment: $CONDA_ENV${NC}"
    conda activate "$CONDA_ENV"
else
    echo -e "${RED}❌ Conda environment '$CONDA_ENV' not found${NC}"
    exit 1
fi

# Check if .env exists, if not create from .env.example
if [ ! -f "$BACKEND_DIR/.env" ]; then
    if [ -f "$BACKEND_DIR/.env.example" ]; then
        echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example${NC}"
        cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
        echo -e "${GREEN}✅ .env created. Please update it with your configuration.${NC}"
    fi
fi

# Load environment variables
if [ -f "$BACKEND_DIR/.env" ]; then
    echo -e "${GREEN}📋 Loading environment from .env${NC}"
    export $(cat "$BACKEND_DIR/.env" | grep -v '^#' | xargs)
fi

# Set defaults if not in .env
export PYTHONUNBUFFERED=1
export LOG_LEVEL=${LOG_LEVEL:-"info"}
export HOST=${HOST:-"0.0.0.0"}
export PORT=${PORT:-"8001"}
export WORKERS=${WORKERS:-"1"}

echo -e "${GREEN}Configuration:${NC}"
echo "  Host: $HOST"
echo "  Port: $PORT"
echo "  Workers: $WORKERS"
echo "  Log Level: $LOG_LEVEL"
echo ""

# Check Python version
PYTHON_VERSION=$(python --version 2>&1)
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Python not found. Please activate conda environment.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ $PYTHON_VERSION${NC}"

# Check if dependencies are installed (skip if using conda env)
if [ -z "$CONDA_DEFAULT_ENV" ] && ! python -c "import fastapi" 2>/dev/null; then
    echo -e "${RED}❌ FastAPI not found. Please ensure conda environment is activated or install dependencies.${NC}"
    exit 1
fi

echo -e "${YELLOW}⏭️  Note: Database setup requires PostgreSQL to be running.${NC}"

echo ""
echo -e "${GREEN}✨ Starting FastAPI server...${NC}"
echo -e "${GREEN}📊 API docs available at: http://$HOST:$PORT/docs${NC}"
echo ""

# Start the server (use main_dev.py if dependencies missing, otherwise use main.py)
cd "$BACKEND_DIR"
if python -c "import structlog pandas" 2>/dev/null; then
    # Full mode with all dependencies
    exec python -m uvicorn app.main:app \
        --host "$HOST" \
        --port "$PORT" \
        --workers "$WORKERS" \
        --log-level "$LOG_LEVEL"
else
    # Development mode with minimal dependencies
    echo -e "${YELLOW}📦 Running in development mode (some features disabled)${NC}"
    exec python -m uvicorn app.main_dev:app \
        --host "$HOST" \
        --port "$PORT" \
        --workers "$WORKERS" \
        --log-level "$LOG_LEVEL"
fi
