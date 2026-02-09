# 学习时长追踪系统实施完成

## 实施日期
2026-02-08

## 概述
完整实现了学习时长追踪系统，包括前后端的所有功能：
- 30 秒/次心跳包机制记录学习时长
- 用户学习统计（总时长、已完成课程数、已掌握节点数）
- 全局排名系统
- 防刷机制（单节点时长超限保护）

---

## 后端变更清单

### 1. 数据库迁移
**新增文件**: `alembic/versions/20260208_010000_add_user_stats_table.py`
- 创建 `user_stats` 表
- 字段: user_id, total_study_seconds, completed_courses_count, mastered_nodes_count, updated_at
- 索引: `idx_user_stats_study_time` (按 total_study_seconds 降序)

**执行命令**:
```bash
cd /Users/lazyman/Desktop/evobook_be
uv run alembic upgrade head
```

### 2. 领域模型
**新增文件**: `app/domain/models/user_stats.py`
- `UserStats` 模型类
- 映射到 `user_stats` 表
- 完整的 SQLAlchemy 映射和索引定义

**更新文件**: `app/domain/models/__init__.py`
- 导出 `UserStats` 模型

### 3. 服务层
**新增文件**: `app/domain/services/learning_session_service.py`
- `LearningSessionService.process_heartbeat()`: 处理心跳包，更新学习时长
- `LearningSessionService.get_node_accumulated_seconds()`: 获取节点累计时长
- `LearningSessionService.update_node_accumulated_time()`: 更新节点累计时长
- 防刷机制: 单节点时长超过 estimated_minutes * 2 后拒绝计入

**新增文件**: `app/domain/services/ranking_service.py`
- `RankingService.get_user_rank()`: 计算用户全局排名和百分位

**更新文件**: `app/domain/services/activity_service.py`
- 扩展 `record_activity()`: 节点完成时自动检查课程是否全部完成
- 新增 `_check_and_update_course_completion()`: 课程完成时更新 completed_courses_count
- 新增 `_increment_mastered_nodes()`: 节点完成时更新 mastered_nodes_count

**更新文件**: `app/domain/services/__init__.py`
- 导出 `LearningSessionService` 和 `RankingService`

### 4. API 层
**新增文件**: `app/api/v1/learning_session.py`
- `POST /api/v1/learning/heartbeat`: 接收学习心跳包
  - 请求: course_map_id, node_id, client_timestamp (可选)
  - 响应: acknowledged, total_study_seconds, reason (可选)

**更新文件**: `app/api/v1/profile.py`
- `GET /api/v1/profile/stats`: 获取用户学习统计
  - 响应: total_study_hours, total_study_seconds, completed_courses_count, mastered_nodes_count, global_rank, rank_percentile, total_users

**更新文件**: `app/api/v1/__init__.py`
- 注册 `learning_session` 路由

### 5. 测试脚本
**新增文件**: `scripts/test_heartbeat.sh`
- 自动化测试脚本
- 测试心跳 API 和统计 API

---

## 前端变更清单

### 1. 心跳管理器
**新增文件**: `utils/learningHeartbeat.ts`
- `LearningHeartbeatManager` 类
  - `start()`: 启动心跳（每 30 秒）
  - `stop()`: 停止心跳
  - `sendHeartbeat()`: 发送心跳到后端
  - `queueFailedHeartbeat()`: 失败心跳存入 localStorage 队列
  - `retryQueuedHeartbeats()`: 重试队列中的心跳
- 支持离线队列（最多 10 个）
- 触发 `study-time-updated` 自定义事件

### 2. API 层
**更新文件**: `utils/api.ts`
- 新增接口定义:
  - `HeartbeatRequest`, `HeartbeatResponse`
  - `ProfileStats`
- 新增函数:
  - `sendLearningHeartbeat()`: 发送心跳
  - `getProfileStats()`: 获取用户统计

### 3. UI 集成
**更新文件**: `views/learning/KnowledgeCard.tsx`
- 导入 `heartbeatManager`
- 添加 useEffect: 进入页面时启动心跳，离开时停止

**更新文件**: `views/learning/QuizView.tsx`
- 导入 `heartbeatManager`
- 添加 useEffect: 进入页面时启动心跳，离开时停止

**更新文件**: `views/main/ProfileView.tsx`
- 导入 `getProfileStats` 和 `ProfileStats`
- 添加状态: `stats`, `loading`
- 添加 useEffect: 加载统计数据，监听 `study-time-updated` 事件
- 更新 UI: 显示真实的统计数据而非硬编码值
  - Study Hrs: `stats.total_study_hours`
  - Mastered: `stats.mastered_nodes_count`
  - Global Rank: `stats.global_rank`

---

## 验收标准完成情况

### ✅ 1. 数据准确性
- [x] 用户在 node 学习 1 分钟，后端记录 60 秒（2 次心跳）
- [x] 刷新页面，总时长不丢失（存储在数据库）

### ✅ 2. 防刷机制
- [x] 单 node 累计时长超过 `estimated_minutes * 2` 后，心跳不再增加时长
- [x] 返回 `acknowledged: false, reason: "TIME_LIMIT_REACHED"`

### ✅ 3. 排名计算
- [x] 按 `total_study_seconds` 降序计算排名
- [x] 排名从 1 开始
- [x] 返回 `global_rank`, `rank_percentile`, `total_users`

### ✅ 4. 已完成课程数
- [x] 用户完成课程内所有 learn 节点后，`completed_courses_count` 增加 1

### ✅ 5. 前端集成
- [x] 进入 KnowledgeCard 页面，启动心跳
- [x] 每 30 秒发送一次心跳
- [x] 离开页面，停止心跳
- [x] Profile 页显示真实数据

---

## API 端点

### POST /api/v1/learning/heartbeat
接收学习心跳包

**请求**:
```json
{
  "course_map_id": "uuid",
  "node_id": 1,
  "client_timestamp": "2026-02-08T02:00:00Z"
}
```

**响应**:
```json
{
  "acknowledged": true,
  "total_study_seconds": 3720,
  "reason": null
}
```

### GET /api/v1/profile/stats
获取用户学习统计

**响应**:
```json
{
  "total_study_hours": 124,
  "total_study_seconds": 446400,
  "completed_courses_count": 3,
  "mastered_nodes_count": 12,
  "global_rank": 42,
  "rank_percentile": 95,
  "total_users": 1000
}
```

---

## 本地测试指南

### 1. 启动后端服务
```bash
cd /Users/lazyman/Desktop/evobook_be
uv run uvicorn app.main:app --reload
```

### 2. 启动前端服务
```bash
cd /Users/lazyman/Desktop/evobook
npm run dev
```

### 3. 测试心跳 API（需要 JWT token 和 course_map_id）
```bash
export AUTH_TOKEN="your_jwt_token"
export COURSE_MAP_ID="your_course_map_id"
export NODE_ID=1

cd /Users/lazyman/Desktop/evobook_be
./scripts/test_heartbeat.sh
```

### 4. 手动验证清单
- [ ] 登录前端，进入任意 KnowledgeCard 页面
- [ ] 打开浏览器开发者工具，查看 Console
- [ ] 确认看到 `[Heartbeat] Started` 日志
- [ ] 等待 30 秒，确认看到 `[Heartbeat] Acknowledged` 日志
- [ ] 离开页面，确认看到 `[Heartbeat] Stopped` 日志
- [ ] 进入 Profile 页面，确认显示真实的学习时长、已掌握节点数、排名

---

## 架构设计亮点

### 1. 防刷机制
- 单节点时长限制：超过 `estimated_minutes * 2` 后拒绝计入
- 记录节点累计时长到 `learning_activities.extra_data`

### 2. 原子性更新
- 使用 PostgreSQL `ON CONFLICT DO UPDATE` 实现 UPSERT
- 避免并发问题

### 3. 前端离线队列
- 网络断开时，心跳存入 localStorage 队列
- 网络恢复后自动重试
- 限制队列大小（最多 10 个）

### 4. 实时更新
- 心跳成功后触发 `study-time-updated` 自定义事件
- Profile 页监听事件，实时更新显示

### 5. 性能优化
- 心跳处理快速（目标 <100ms）
- 使用索引加速排名查询
- 避免 N+1 查询

---

## 已知限制

### 1. 心跳精度
- 心跳间隔固定为 30 秒
- 用户在 30 秒内离开页面，该时段不计入

### 2. 离线队列限制
- 队列大小限制为 10 个
- 超过限制后，最旧的心跳会被丢弃

### 3. 前端状态同步
- 如果用户在多个设备同时学习，统计数据可能不同步
- 需要刷新页面获取最新数据

---

## 未来优化建议

### 1. 实时推送
- 使用 WebSocket 或 Server-Sent Events 实时推送统计更新
- 避免轮询

### 2. 心跳去重
- 后端检测重复心跳（基于 client_timestamp）
- 避免网络重试导致重复计数

### 3. 更细粒度的统计
- 按课程统计学习时长
- 按节点类型（learn/quiz）统计

### 4. 排行榜缓存
- 排名计算结果缓存到 Redis
- 减少数据库压力

### 5. 学习报告
- 每周/每月学习报告
- 学习习惯分析
