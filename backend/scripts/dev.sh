#!/bin/bash
# Start both backend and frontend for development
# Usage: ./scripts/dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="/Users/lazyman/Desktop/evobook"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting EvoBook development servers...${NC}"
echo ""

# Check if backend .env exists
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo -e "${YELLOW}Warning: Backend .env file not found. Copy from .env.example:${NC}"
    echo "  cp $BACKEND_DIR/.env.example $BACKEND_DIR/.env"
    echo ""
fi

# Check if Postgres is running
if ! docker ps | grep -q evobook-postgres; then
    echo -e "${YELLOW}Starting Postgres container...${NC}"
    docker start evobook-postgres 2>/dev/null || {
        echo -e "${RED}Postgres container not found. Please run:${NC}"
        echo "  docker run -d --name evobook-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=evobook -p 5432:5432 postgres:16-alpine"
        exit 1
    }
fi

# Function to cleanup background processes
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}Servers stopped.${NC}"
    exit 0
}

# Trap to cleanup on exit
trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${GREEN}Starting backend on port 8000...${NC}"
cd "$BACKEND_DIR"
uv run uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

# Start frontend
echo -e "${GREEN}Starting frontend on port 3000...${NC}"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Development servers are running:${NC}"
echo -e "  Backend:  ${YELLOW}http://localhost:8000${NC}"
echo -e "  Frontend: ${YELLOW}http://localhost:3000${NC}"
echo -e "  API Docs: ${YELLOW}http://localhost:8000/docs${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Press ${RED}Ctrl+C${NC} to stop both servers"
echo ""

# Wait for any process to exit
wait
