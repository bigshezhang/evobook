# EvoBook Backend Runbook (Local)

## 1) Prerequisites
- Python 3.11+ recommended
- Postgres running locally (or via Docker)
- Environment variables set

## 2) Environment Variables

Required:
```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/evobook
LITELLM_MODEL=gpt-4o-mini
```

Optional:
```bash
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR
```

Provider keys (required by LiteLLM based on model):
```bash
OPENAI_API_KEY=sk-xxx
# or ANTHROPIC_API_KEY=sk-ant-xxx
```

Copy `.env.example` to `.env` and fill in values:
```bash
cp .env.example .env
```

## 3) Database Setup (Docker)

Start Postgres:
```bash
docker run -d \
  --name evobook-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=evobook \
  -p 5432:5432 \
  postgres:16-alpine
```

Create test database:
```bash
docker exec -it evobook-postgres psql -U postgres -c "CREATE DATABASE evobook_test;"
```

## 4) Python Setup (uv)

Install uv (if not already installed):
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Sync dependencies:
```bash
uv sync
```

This will create a `.venv` and install all dependencies including dev dependencies.

Alternative (pip):
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## 5) Database Migrations

Generate initial migration (first time only):
```bash
uv run alembic revision --autogenerate -m "Initial tables"
```

Apply migrations:
```bash
uv run alembic upgrade head
```

## 6) Run Server

Development mode with auto-reload:
```bash
uv run uvicorn app.main:app --reload --port 8000
```

Or with activated venv:
```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

OpenAPI documentation:
- Swagger UI: http://localhost:8000/docs
- OpenAPI JSON: http://localhost:8000/openapi.json

## 7) Quick Validation (curl)

Health check:
```bash
curl http://localhost:8000/healthz
# Expected: {"ok":true,"ts":"2026-02-01T12:00:00.000000+00:00"}
```

Trigger 404 (verify JSON error response):
```bash
curl http://localhost:8000/api/v1/nonexistent
# Expected: {"detail":"Not Found"}
```

### Onboarding API

**Create a new onboarding session:**
```bash
curl -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d '{"session_id": null, "user_message": null, "user_choice": null}'
# Expected: {"type":"chat","message":"...","options":["...","...","..."],"session_id":"<uuid>"}
```

**Continue with a user choice (replace SESSION_ID with actual UUID):**
```bash
# Step 1: Create session and save the session_id
SESSION_ID=$(curl -s -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d '{"session_id": null}' | jq -r '.session_id')
echo "Session ID: $SESSION_ID"

# Step 2: Select a topic
curl -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\", \"user_choice\": \"Python 编程\"}"

# Step 3: Answer calibration question
curl -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\", \"user_choice\": \"完全没听过\"}"
```

**Complete full onboarding flow (6 steps to finish):**
```bash
# This script walks through the entire onboarding flow
SESSION_ID=$(curl -s -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.session_id')

echo "Step 1 - Session created: $SESSION_ID"

echo "Step 2 - Selecting topic..."
curl -s -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\", \"user_choice\": \"Python 编程\"}" | jq .

echo "Step 3 - Calibration R1..."
curl -s -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\", \"user_choice\": \"完全没听过\"}" | jq .

echo "Step 4 - Calibration R2..."
curl -s -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\", \"user_choice\": \"完全零基础\"}" | jq .

echo "Step 5 - Focus..."
curl -s -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\", \"user_choice\": \"能独立写小程序\"}" | jq .

echo "Step 6 - Source (should return finish)..."
curl -s -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\", \"user_choice\": \"朋友推荐\"}" | jq .

# Expected final response:
# {
#   "type": "finish",
#   "data": {
#     "topic": "Python 编程",
#     "level": "Beginner",
#     "verified_concept": "装饰器",
#     "focus": "能独立写小程序",
#     "source": "朋友推荐",
#     "intent": "add_info"
#   },
#   "session_id": "<uuid>"
# }
```

## 8) Running Tests

Ensure test database exists:
```bash
docker exec -it evobook-postgres psql -U postgres -c "CREATE DATABASE evobook_test;" 2>/dev/null || true
```

Run all tests:
```bash
uv run pytest -q
```

Run with verbose output:
```bash
uv run pytest -v
```

Run specific test file:
```bash
uv run pytest tests/test_health.py -v
```

## 9) Project Structure

```
evobook_be/
├── alembic/              # Database migrations
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── app/
│   ├── api/
│   │   └── v1/           # API routes
│   │       └── health.py
│   ├── core/             # Core utilities
│   │   ├── exceptions.py # Error handling
│   │   ├── logging.py    # Structured logging
│   │   └── middleware.py # Request middleware
│   ├── domain/
│   │   └── models/       # SQLAlchemy models
│   ├── infrastructure/
│   │   └── database.py   # DB configuration
│   ├── prompts/          # LLM prompt files
│   ├── config.py         # Settings
│   └── main.py           # FastAPI app
├── docs/
├── tests/
├── .env.example
├── alembic.ini
├── pytest.ini
└── requirements.txt
```

## 10) Frontend Integration (联调)

### Prerequisites

Ensure both backend and frontend are set up:

**Backend:**
```bash
cd /Users/lazyman/Desktop/evobook_be
cp .env.example .env  # Fill in your API keys
uv sync
uv run alembic upgrade head
```

**Frontend:**
```bash
cd /Users/lazyman/Desktop/evobook
npm install
```

### One-Click Startup

Use the dev script to start both servers:
```bash
cd /Users/lazyman/Desktop/evobook_be
./scripts/dev.sh
```

This will:
1. Start Postgres container (if not running)
2. Start backend on http://localhost:8000
3. Start frontend on http://localhost:3000
4. Handle cleanup on Ctrl+C

### Manual Startup (Separate Terminals)

**Terminal 1 - Backend:**
```bash
cd /Users/lazyman/Desktop/evobook_be
uv run uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd /Users/lazyman/Desktop/evobook
npm run dev
```

### Frontend Environment Variables

The frontend uses `.env.development` for local development:
```bash
# /Users/lazyman/Desktop/evobook/.env.development
VITE_API_BASE_URL=http://localhost:8000
```

### CORS Configuration

The backend is configured to accept requests from:
- http://localhost:3000
- http://127.0.0.1:3000
- http://0.0.0.0:3000

### Verification Steps

1. **Check backend health:**
```bash
curl http://localhost:8000/healthz
```

2. **Check CORS preflight:**
```bash
curl -X OPTIONS http://localhost:8000/api/v1/onboarding/next \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v 2>&1 | grep -i "access-control"
```

3. **Open frontend in browser:**
```
http://localhost:3000
```

4. **Test onboarding flow:**
   - Navigate to the assessment chat page
   - Verify that the AI greeting message loads
   - Select options and verify responses
   - Complete the flow and verify navigation to companion selection

### Troubleshooting

**CORS errors in browser console:**
- Ensure backend is running on port 8000
- Check that the frontend URL matches allowed origins
- Clear browser cache and retry

**API connection refused:**
- Verify backend is running: `curl http://localhost:8000/healthz`
- Check DATABASE_URL in backend .env
- Ensure Postgres is running: `docker ps | grep evobook-postgres`

**Session errors:**
- Clear localStorage: `localStorage.clear()` in browser console
- Restart the onboarding flow

## 11) Testing Scripts

### LLM Client Test

Verify the LiteLLM client with mock responses:
```bash
uv run python3 scripts/test_llm.py
```

### End-to-End Test

The e2e test script validates the complete user journey:
1. Onboarding (multi-turn conversation until finish)
2. Course map (DAG) generation
3. Knowledge card generation
4. Quiz generation

**Prerequisites:**
- Server must be running (with or without MOCK_LLM)
- For mock mode, start server with `MOCK_LLM=1`

**Run with mock LLM (recommended for testing):**
```bash
# Terminal 1: Start server with mock LLM
MOCK_LLM=1 uv run uvicorn app.main:app --reload --port 8000

# Terminal 2: Run e2e test
uv run python3 scripts/e2e_run.py
```

**Run with real LLM:**
```bash
# Terminal 1: Start server (requires API keys in .env)
uv run uvicorn app.main:app --reload --port 8000

# Terminal 2: Run e2e test
uv run python3 scripts/e2e_run.py
```

**Custom API URL:**
```bash
API_BASE_URL=http://localhost:8080 uv run python3 scripts/e2e_run.py
```

**Output:**
- Results saved to `.out/` directory
- Files: `1_onboarding.json`, `2_course_map.json`, `3_knowledge_card.json`, `4_quiz.json`, `e2e_results.json`

**Expected output (mock mode):**
```
============================================================
EvoBook E2E Test
============================================================
  Timestamp: 2026-02-01 12:00:00
  API Base URL: http://localhost:8000
  Output Dir: /path/to/.out

[0/4] Checking API health...
  ✓ API is healthy

[1/4] Running onboarding...
    Step 1: chat - 你好！我是你的学习向导。你想学习什么呢？...
    Step 2: chat - 太棒了！让我了解一下你的基础。你对「装饰器」这个概念熟悉吗？...
    Step 3: chat - 明白了！那你之前有接触过编程吗？...
    Step 4: chat - 了解了！如果给你 2-4 周，你最想达成什么目标？...
    Step 5: chat - 最后一个问题：你是从哪里了解到我们的？...
    Step 6: finish - 太好了！你的学习档案已经准备好了。...
  ✓ Onboarding complete: topic=Python 编程

[2/4] Generating course map...
  ✓ Course map: 5 nodes, 120 minutes

[3/4] Generating knowledge card...
  ✓ Knowledge card: 2 pages

[4/4] Generating quiz...
  ✓ Quiz: 5 questions

============================================================
SUMMARY
============================================================

📚 Onboarding:
   Topic: Python 编程
   Level: Beginner
   Focus: 能独立写小程序

🗺️  Course Map:
   Name: Python 编程入门之旅
   Nodes: 5
   Total Time: 120 min
   Node Types: learn, quiz

📄 Knowledge Card:
   Pages: 2
   Markdown Length: 1234 chars

❓ Quiz:
   Title: Python Variables Quiz
   Questions: 5
   Question Types: single, boolean, multi

============================================================
E2E Test Complete!
Results saved to: /path/to/.out
============================================================
```
