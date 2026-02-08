# Background Content Generation - Test Guide

## 功能概述

实现了课程创建后自动后台生成所有 learn 节点内容的功能。

### 主要特性

1. **后台生成**: 使用 FastAPI BackgroundTasks，无需 Celery
2. **状态追踪**: node_contents 表增加生成状态字段
3. **进度查询**: 新增 GET /api/v1/course-map/{course_map_id}/progress 接口
4. **前端轮询**: KnowledgeTree 组件每 2 秒轮询一次进度
5. **并发控制**: 同时最多 3 个节点生成（避免 API 限流）
6. **按层级生成**: 先生成 Layer 1，再 Layer 2，依此类推

## 数据库变更

### Migration

文件: `alembic/versions/20260208_210444_add_generation_status_to_node_contents.py`

新增字段:
- `generation_status` (VARCHAR(50)): 生成状态
- `generation_started_at` (TIMESTAMP): 开始时间
- `generation_completed_at` (TIMESTAMP): 完成时间
- `generation_error` (TEXT): 错误信息
- `node_type` (VARCHAR(50)): 节点类型 (learn|quiz)

状态值:
- `pending`: 等待生成（learn 节点初始状态）
- `generating`: 生成中
- `completed`: 已完成
- `failed`: 生成失败
- `quiz_pending`: Quiz 节点（不需要预生成）
- `quiz_completed`: Quiz 已完成（用户触发后）

### 运行 Migration

```bash
cd /Users/lazyman/Desktop/evobook_be
python3 -m alembic upgrade head
```

## 后端实现

### 1. Domain Model 更新

文件: `app/domain/models/node_content.py`

增加了生成状态相关字段和索引。

### 2. 后台生成服务

文件: `app/domain/services/content_generation_service.py`

主要类和函数:
- `ContentGenerationService`: 后台生成服务类
  - `generate_all_learn_nodes()`: 生成所有 learn 节点
  - `_generate_single_node()`: 生成单个节点（带重试）
  - `_update_generation_status()`: 更新生成状态
- `initialize_node_contents()`: 初始化 node_contents 记录

### 3. API 端点修改

文件: `app/api/v1/course_map.py`

#### 修改的端点

**POST /api/v1/course-map/generate**

变更:
1. 增加 `BackgroundTasks` 参数
2. 生成 DAG 后立即初始化 node_contents 记录
3. 触发后台任务生成所有 learn 节点内容
4. 立即返回给前端（不阻塞）

#### 新增的端点

**GET /api/v1/course-map/{course_map_id}/progress**

功能: 查询课程内容生成进度

Response:
```json
{
  "course_map_id": "uuid",
  "overall_status": "generating",
  "learn_progress": 0.33,
  "nodes_status": [
    {
      "node_id": 1,
      "type": "learn",
      "status": "completed",
      "error": null
    },
    {
      "node_id": 2,
      "type": "learn",
      "status": "generating",
      "error": null
    }
  ]
}
```

## 前端实现

### 1. API 函数

文件: `utils/api.ts`

新增:
- `NodeGenerationStatus` 接口
- `GenerationProgressResponse` 接口
- `getGenerationProgress()` 函数

### 2. KnowledgeTree 组件

文件: `views/learning/KnowledgeTree.tsx`

变更:
1. 增加 `nodeGenerationStatus` 状态
2. 增加轮询 useEffect（每 2 秒）
3. `getNodeState()` 增加 'generating' 状态
4. 节点样式增加生成中状态（蓝色边框 + 动画）
5. 生成中的节点显示旋转图标和 "Generating..." 文字

## 测试步骤

### 1. 启动后端服务

```bash
cd /Users/lazyman/Desktop/evobook_be
# 确保环境变量已配置
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 启动前端服务

```bash
cd /Users/lazyman/Desktop/evobook
npm run dev
```

### 3. 测试流程

1. **创建新课程**
   - 完成 onboarding 流程
   - 点击生成课程
   - 观察后端日志，应该看到:
     - "Initialized node_contents records"
     - "Triggered background generation for learn nodes"
     - "Background task started for content generation"

2. **查看生成进度**
   - 进入 KnowledgeTree 页面
   - 应该看到 learn 节点显示蓝色边框和旋转图标
   - 下方显示 "Generating..." 文字

3. **监控后台日志**
   ```
   INFO  [app.domain.services.content_generation_service] Starting background generation for all learn nodes
   INFO  [app.domain.services.content_generation_service] Filtered learn nodes for generation
   INFO  [app.domain.services.content_generation_service] Generating nodes for layer
   INFO  [app.domain.services.node_content_service] Generating knowledge card
   INFO  [app.domain.services.content_generation_service] Node content generated successfully
   ```

4. **验证完成**
   - 等待所有节点生成完成（根据节点数量，可能需要几分钟）
   - 生成完成后，节点应该变为可点击状态
   - 点击节点应该能立即显示内容（从缓存读取）

### 4. 验证数据库

```sql
-- 查看 node_contents 记录
SELECT
    node_id,
    node_type,
    generation_status,
    generation_started_at,
    generation_completed_at,
    generation_error
FROM node_contents
WHERE course_map_id = 'your-course-map-id'
ORDER BY node_id;

-- 统计生成状态
SELECT
    generation_status,
    COUNT(*)
FROM node_contents
WHERE course_map_id = 'your-course-map-id'
GROUP BY generation_status;
```

### 5. 测试进度接口

```bash
# 替换 YOUR_COURSE_MAP_ID 和 YOUR_TOKEN
curl -X GET "http://localhost:8000/api/v1/course-map/YOUR_COURSE_MAP_ID/progress" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 错误处理

### 单个节点失败

- 单个节点生成失败不会阻塞其他节点
- 失败的节点状态设为 `failed`，记录错误信息
- 用户可以在前端看到失败状态
- 后续可以手动重试（待实现）

### 后台任务异常

- 所有异常都会被捕获并记录
- 不会影响主请求的成功返回
- 查看后端日志获取详细错误信息

## 性能考虑

### 并发控制

- 使用 `asyncio.Semaphore(3)` 限制并发数
- 避免同时发起太多 LLM 请求导致限流

### 按层级生成

- 先生成低层节点，再生成高层节点
- 符合学习路径的依赖关系
- 便于用户尽早开始学习

### 轮询优化

- 前端只在有 generating/pending 节点时才轮询
- 所有节点完成后自动停止轮询
- 避免不必要的 API 请求

## 未来优化

1. **重试机制**: 前端增加手动重试失败节点的功能
2. **WebSocket**: 替换轮询为 WebSocket 推送进度
3. **优先级**: 用户可以选择优先生成某些节点
4. **暂停/恢复**: 支持暂停和恢复后台生成
5. **进度条**: 更详细的进度显示（已完成/总数）

## 故障排查

### 节点一直显示 "Generating..."

1. 检查后端日志是否有错误
2. 查询数据库 generation_status 字段
3. 检查 LLM API 是否正常
4. 确认环境变量配置正确

### 前端不显示生成状态

1. 检查 API 请求是否成功（浏览器 Network 面板）
2. 检查 node_contents 表是否有记录
3. 检查前端控制台是否有错误

### 后台任务未启动

1. 检查 FastAPI 版本（需要支持 BackgroundTasks）
2. 检查 initialize_node_contents 是否成功
3. 检查数据库连接是否正常

## 相关文件清单

### 后端

- `alembic/versions/20260208_210444_add_generation_status_to_node_contents.py` (新建)
- `app/domain/models/node_content.py` (修改)
- `app/domain/services/content_generation_service.py` (新建)
- `app/api/v1/course_map.py` (修改)
- `app/infrastructure/database.py` (修改)

### 前端

- `utils/api.ts` (修改)
- `views/learning/KnowledgeTree.tsx` (修改)

## 验收标准

✅ 用户创建课程后，立即返回 course_map_id
✅ 后台开始生成所有 learn 节点内容
✅ 前端 KnowledgeTree 显示生成进度（蓝色边框 + 旋转图标）
✅ 节点生成完成后，可以点击学习
✅ Quiz 节点不显示生成状态（保持原有的即时生成逻辑）
✅ 数据库中 node_contents 表有正确的状态记录
✅ 单个节点失败不影响其他节点
