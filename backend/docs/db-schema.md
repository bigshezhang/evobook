# EvoBook Database Schema (Postgres)

> 目标：所有会话与生成结果可追溯、可复现（至少通过 request_id + prompt_hash）。

## Conventions
- Primary key: uuid (generated in app)
- created_at / updated_at: timestamptz
- Index foreign keys and frequently queried fields.

---

## 1) onboarding_sessions
Stores onboarding dialogue state and final profile.

Fields (suggested):
- id (uuid, pk)
- phase (text)  // exploration | calibration_r1 | calibration_r2 | focus | source | handoff
- topic (text, nullable)
- level (text, nullable)  // Novice/Beginner/Intermediate/Advanced
- verified_concept (text, nullable)
- focus (text, nullable)
- source (text, nullable)
- intent (text, nullable) // add_info/change_topic
- state_json (jsonb)      // full internal state snapshot
- created_at, updated_at

Indexes:
- pk(id)
- idx_onboarding_phase (phase)
- idx_onboarding_topic (topic)

---

## 2) prompt_runs
Stores each LLM request/response trace.

Fields:
- id (uuid, pk)
- request_id (uuid, unique)
- prompt_name (text)
- prompt_hash (text)  // sha256 hex
- model (text)
- success (bool)
- retries (int)
- latency_ms (int)
- raw_text (text, nullable)  // optionally truncated
- parsed_json (jsonb, nullable)
- created_at

Indexes:
- unique(request_id)
- idx_prompt_runs_prompt_name (prompt_name)
- idx_prompt_runs_prompt_hash (prompt_hash)
- idx_prompt_runs_created_at (created_at)

---

## 3) course_maps
Stores generated DAG.

Fields:
- id (uuid, pk)
- onboarding_session_id (uuid, fk -> onboarding_sessions.id)
- mode (text) // Deep/Fast/Light
- total_commitment_minutes (int)
- map_json (jsonb) // whole response JSON
- created_at

Indexes:
- idx_course_maps_session (onboarding_session_id)

---

## 4) node_contents
Stores knowledge cards and other per-node artifacts.

Fields:
- id (uuid, pk)
- course_map_id (uuid, fk -> course_maps.id)
- node_id (int)
- content_type (text) // knowledge_card | clarification | qa_detail
- content_json (jsonb) // store response JSON
- created_at

Indexes:
- idx_node_contents_course_node (course_map_id, node_id)
- idx_node_contents_type (content_type)

---

## 5) quizzes (optional)
If separated from node_contents.

Fields:
- id (uuid, pk)
- course_map_id (uuid, fk)
- quiz_json (jsonb)
- created_at

---

## Migration Requirements
- Use Alembic.
- Each table creation is a migration.
- Never modify DB manually; always via migrations.
