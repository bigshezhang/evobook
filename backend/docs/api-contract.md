# EvoBook Backend API Contract

> 说明：后端稳定前缀为 `/api/v1`。
> 前端可直接依据 FastAPI 的 OpenAPI 文档对齐：`/docs`（Swagger UI）与 `/openapi.json`。

## Base
- Base URL: `http://localhost:8000`
- API Prefix: `/api/v1`
- Content-Type: `application/json`

---

## Health

### GET /healthz

健康检查接口。

**Response:**
```json
{ "ok": true, "ts": "2026-02-01T12:00:00Z" }
```

---

## Onboarding

### POST /api/v1/onboarding/next

处理 onboarding 对话流程。支持开始新会话、发送用户消息或选择预设选项。

**Request:**
```json
{
  "session_id": "uuid | null",
  "user_message": "string | null",
  "user_choice": "string | null"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| `session_id` | UUID | 否 | 会话 ID，首次请求为 null |
| `user_message` | string | 否 | 用户自由输入的消息 |
| `user_choice` | string | 否 | 用户选择的预设选项 |

**Response (type=chat):**
```json
{
  "type": "chat",
  "message": "你好！我是 Athena，你的学习助手。你想学习什么？",
  "options": ["Python 编程", "Web 开发", "数据科学"],
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (type=finish):**
```json
{
  "type": "finish",
  "data": {
    "topic": "Python 编程",
    "level": "Beginner",
    "verified_concept": "变量与数据类型",
    "focus": "从零开始学习编程基础",
    "source": "想转行做程序员",
    "intent": "add_info"
  },
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| `data` 字段 | 类型 | 说明 |
|------------|------|------|
| `topic` | string | 学习主题 |
| `level` | enum | 水平：Novice / Beginner / Intermediate / Advanced |
| `verified_concept` | string | 验证的核心概念 |
| `focus` | string | 学习重点/目标 |
| `source` | string | 学习动机来源 |
| `intent` | enum | 意图：add_info / change_topic |

---

## Course Map (DAG)

### POST /api/v1/course-map/generate

生成课程学习路径 DAG。

**Request:**
```json
{
  "topic": "Python 编程",
  "level": "Beginner",
  "focus": "从零开始学习编程基础",
  "verified_concept": "变量与数据类型",
  "mode": "Fast",
  "total_commitment_minutes": 120
}
```

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| `topic` | string | 是 | 学习主题 |
| `level` | enum | 是 | Novice / Beginner / Intermediate / Advanced |
| `focus` | string | 是 | 学习重点 |
| `verified_concept` | string | 是 | 验证的概念 |
| `mode` | enum | 是 | Deep / Fast / Light |
| `total_commitment_minutes` | int | 是 | 总学习时间（30-480 分钟）|

**Response:**
```json
{
  "map_meta": {
    "course_name": "Python 编程基础",
    "strategy_rationale": "从基础语法开始，逐步深入...",
    "mode": "Fast",
    "time_budget_minutes": 120,
    "time_sum_minutes": 120,
    "time_delta_minutes": 0
  },
  "nodes": [
    {
      "id": 1,
      "title": "Python 简介",
      "description": "了解 Python 的历史和应用场景",
      "type": "learn",
      "layer": 1,
      "pre_requisites": [],
      "estimated_minutes": 15
    },
    {
      "id": 2,
      "title": "变量与数据类型",
      "description": "学习基本数据类型和变量定义",
      "type": "learn",
      "layer": 2,
      "pre_requisites": [1],
      "estimated_minutes": 25
    },
    {
      "id": 3,
      "title": "基础测验",
      "description": "检验对基础概念的理解",
      "type": "quiz",
      "layer": 3,
      "pre_requisites": [2],
      "estimated_minutes": 10
    }
  ]
}
```

| `map_meta` 字段 | 类型 | 说明 |
|----------------|------|------|
| `course_name` | string | 课程名称 |
| `strategy_rationale` | string | 策略说明 |
| `mode` | enum | 学习模式 |
| `time_budget_minutes` | int | 预算时间 |
| `time_sum_minutes` | int | 实际总时间 |
| `time_delta_minutes` | int | 时间差值 |

| `nodes[]` 字段 | 类型 | 说明 |
|---------------|------|------|
| `id` | int | 节点 ID |
| `title` | string | 节点标题 |
| `description` | string | 节点描述 |
| `type` | enum | learn / quiz / boss |
| `layer` | int | DAG 层级 |
| `pre_requisites` | int[] | 前置节点 ID 列表 |
| `estimated_minutes` | int | 预估学习时间 |

**约束:**
- DAG 必须有分支和汇合（不能是线性路径）
- `sum(nodes[].estimated_minutes) == total_commitment_minutes`
- `mode != Deep` 时禁止 boss 节点

---

## Node Content

### POST /api/v1/node-content/knowledge-card

为指定节点生成知识卡片内容。

**Request:**
```json
{
  "language": "zh",
  "course": {
    "course_name": "Python 编程基础",
    "course_context": "从零开始学习 Python 编程",
    "topic": "Python 编程",
    "level": "Beginner",
    "mode": "Fast"
  },
  "node": {
    "id": 2,
    "title": "变量与数据类型",
    "description": "学习基本数据类型和变量定义",
    "type": "learn",
    "estimated_minutes": 25
  }
}
```

**Response:**
```json
{
  "type": "knowledge_card",
  "node_id": 2,
  "totalPagesInCard": 3,
  "markdown": "## 变量与数据类型\n\n在 Python 中...\n\n<EVOBK_PAGE_BREAK />\n\n## 数字类型\n\n...",
  "yaml": "key_elements:\n  - 变量命名规则\n  - 基本数据类型\nexpert_tips:\n  - 使用有意义的变量名"
}
```

| 字段 | 类型 | 说明 |
|-----|------|------|
| `language` | string | 响应语言（ISO 639-1 代码，如 "en", "zh", "es", "fr", "ja", "de" 等） |
| `type` | string | 固定为 "knowledge_card" |
| `node_id` | int | 节点 ID |
| `totalPagesInCard` | int | 卡片总页数 |
| `markdown` | string | Markdown 内容，包含 `<EVOBK_PAGE_BREAK />` 分页符 |
| `yaml` | string | 结构化元数据 |

**注意**: 所有内容生成接口（knowledge-card、clarification、qa-detail、quiz）都支持 `language` 参数，使用 ISO 639-1 标准语言代码。

---

### POST /api/v1/node-content/clarification

生成用户问题的快速澄清回答。

**Request:**
```json
{
  "language": "zh",
  "user_question_raw": "什么是变量？",
  "page_markdown": "## 变量与数据类型\n\n在 Python 中，变量是..."
}
```

**Response:**
```json
{
  "type": "clarification",
  "corrected_title": "什么是 Python 变量？",
  "short_answer": "变量是程序中用于存储数据的容器。在 Python 中，你可以直接给变量赋值..."
}
```

---

### POST /api/v1/node-content/qa-detail

生成 QA 的详细解释。

**Request:**
```json
{
  "language": "zh",
  "qa_title": "什么是 Python 变量？",
  "qa_short_answer": "变量是程序中用于存储数据的容器..."
}
```

**Response:**
```json
{
  "type": "qa_detail",
  "title": "深入理解 Python 变量",
  "body_markdown": "## 变量的本质\n\n在 Python 中...",
  "image": {
    "placeholder": "变量内存示意图",
    "prompt": "A diagram showing Python variable memory allocation..."
  }
}
```

---

## Quiz

### POST /api/v1/quiz/generate

根据已学内容生成测验。

**Request:**
```json
{
  "language": "zh",
  "mode": "Fast",
  "learned_topics": [
    {
      "topic_name": "变量与数据类型",
      "pages_markdown": "## 变量与数据类型\n\n在 Python 中..."
    }
  ]
}
```

**Response:**
```json
{
  "type": "quiz",
  "title": "Python 基础测验",
  "greeting": {
    "topics_included": ["变量与数据类型"],
    "message": "让我们来检验一下你对 Python 基础的理解！"
  },
  "questions": [
    {
      "qtype": "single",
      "prompt": "以下哪个是有效的 Python 变量名？",
      "options": ["2name", "_name", "for", "class"],
      "answer": "_name"
    },
    {
      "qtype": "multi",
      "prompt": "以下哪些是 Python 的基本数据类型？",
      "options": ["int", "str", "array", "bool"],
      "answers": ["int", "str", "bool"]
    },
    {
      "qtype": "boolean",
      "prompt": "Python 变量在使用前必须声明类型。",
      "answer": "False"
    }
  ]
}
```

| `questions[]` 字段 | 类型 | 说明 |
|-------------------|------|------|
| `qtype` | enum | single / multi / boolean |
| `prompt` | string | 题目 |
| `options` | string[] | 选项（boolean 类型无此字段）|
| `answer` | string | 单选/判断题答案 |
| `answers` | string[] | 多选题答案列表 |

---

## Profile Stats

### GET /api/v1/profile/stats

获取用户学习统计数据，包括用户名称、注册时间、学习时长、完成课程数和全局排名。

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "user_name": "Alex Rivers",
  "joined_date": "2024-01-15T08:30:00.000000Z",
  "total_study_hours": 2,
  "total_study_seconds": 5460,
  "completed_courses_count": 1,
  "mastered_nodes_count": 12,
  "global_rank": 42,
  "rank_percentile": 95,
  "total_users": 1000
}
```

| 字段 | 类型 | 说明 |
|-----|------|------|
| `user_name` | string | 用户显示名称 |
| `joined_date` | string | 注册时间（ISO 8601 格式） |
| `total_study_hours` | int | 总学习时长（小时，向上取整） |
| `total_study_seconds` | int | 总学习时长（秒） |
| `completed_courses_count` | int | 已完成课程数 |
| `mastered_nodes_count` | int | 已掌握节点数 |
| `global_rank` | int \| null | 全局排名（从 1 开始），无数据时为 null |
| `rank_percentile` | int \| null | 百分位（0-100），无数据时为 null |
| `total_users` | int | 系统中有学习时长统计的总用户数 |

**错误响应：**
- `401`: 未认证
- `404`: 用户 Profile 不存在
- `500`: 内部错误

---

## Error Response (Global)

所有错误统一返回以下 JSON 格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": null
  }
}
```

| 字段 | 类型 | 说明 |
|-----|------|------|
| `error.code` | string | 错误代码 |
| `error.message` | string | 错误消息 |
| `error.details` | any | 可选的详细信息 |

### 常见错误代码

| 代码 | HTTP 状态码 | 说明 |
|-----|-----------|------|
| `VALIDATION_ERROR` | 400 | 请求参数验证失败 |
| `SESSION_NOT_FOUND` | 404 | 会话不存在 |
| `LLM_ERROR` | 500 | LLM 调用失败 |
| `INTERNAL_ERROR` | 500 | 内部服务器错误 |
