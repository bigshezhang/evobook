# EvoBook Backend API Contract (Draft)

> 说明：前端请求路径尚未定稿，因此后端先提供稳定前缀：`/api/v1`。  
> 前端可直接依据 FastAPI 的 OpenAPI 文档对齐：通常为 `/docs`（Swagger UI）与 `/openapi.json`。

## Base
- Base URL: `http://localhost:8000`
- API Prefix: `/api/v1`

## Health
### GET /healthz
Response:
```json
{ "ok": true, "ts": "2026-02-01T12:00:00Z" }
```

## Onboarding
### POST /api/v1/onboarding/next

Request:
```json
{
  "session_id": null,
  "user_message": "I want to learn React",
  "user_choice": null
}
```

Response (chat):
```json
{
  "type": "chat",
  "message": "string",
  "options": ["string","string","string"],
  "session_id": "uuid"
}
```

Response (finish):
```json
{
  "type": "finish",
  "data": {
    "topic": "string",
    "level": "Novice",
    "verified_concept": "string",
    "focus": "string",
    "source": "string",
    "intent": "add_info"
  },
  "session_id": "uuid"
}
```

## Course Map (DAG)
### POST /api/v1/course-map/generate

Request:
```json
{
  "topic": "React",
  "level": "Beginner",
  "focus": "Build a small todo app",
  "verified_concept": "useState",
  "mode": "Fast",
  "total_commitment_minutes": 600
}
```

Response:
```json
{
  "map_meta": {
    "course_name": "string",
    "strategy_rationale": "string",
    "mode": "Fast",
    "time_budget_minutes": 600,
    "time_sum_minutes": 600,
    "time_delta_minutes": 0
  },
  "nodes": [
    {
      "id": 1,
      "title": "string",
      "description": "string",
      "type": "learn",
      "layer": 1,
      "pre_requisites": [],
      "estimated_minutes": 120
    }
  ]
}
```

## Node Content
### POST /api/v1/node-content/knowledge-card

Request:
```json
{
  "course": {
    "course_name": "string",
    "course_context": "string",
    "topic": "string",
    "level": "Beginner",
    "mode": "Fast"
  },
  "node": {
    "id": 2,
    "title": "string",
    "description": "string",
    "type": "learn",
    "estimated_minutes": 16
  }
}
```

Response:
```json
{
  "type": "knowledge_card",
  "node_id": 2,
  "totalPagesInCard": 2,
  "markdown": "string",
  "yaml": "string"
}
```

### POST /api/v1/node-content/clarification
### POST /api/v1/node-content/qa-detail

(详见 .cursor/rules/evobook-backend.mdc)

## Quiz
### POST /api/v1/quiz/generate

(详见 .cursor/rules/evobook-backend.mdc)

## Error Shape (Global)
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": null
  }
}
```
