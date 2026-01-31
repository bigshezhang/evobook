# EvoBook Backend Runbook (Local)

## 1) Prerequisites
- Python 3.11+ recommended
- Postgres running locally (or docker)
- Environment variables set

## 2) Environment Variables
Required:
- DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/evobook
- LITELLM_MODEL=gpt-4o-mini

Optional:
- LOG_LEVEL=INFO
- Provider keys required by litellm (e.g. OPENAI_API_KEY)

## 3) Setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 4) Migrations
```bash
alembic upgrade head
```

## 5) Run Server
```bash
uvicorn app.main:app --reload --port 8000
```

OpenAPI:
- http://localhost:8000/docs
- http://localhost:8000/openapi.json

## 6) Quick Validation (curl)

Health:
```bash
curl http://localhost:8000/healthz
```

Onboarding next:
```bash
curl -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d '{"session_id": null, "user_message": "I want to learn React", "user_choice": null}'
```

Course map:
```bash
curl -X POST http://localhost:8000/api/v1/course-map/generate \
  -H "Content-Type: application/json" \
  -d '{"topic":"React","level":"Beginner","focus":"Build a todo app","verified_concept":"useState","mode":"Fast","total_commitment_minutes":600}'
```

## 7) Scripts
```bash
python3 scripts/test_llm.py
python3 scripts/e2e_run.py
```
