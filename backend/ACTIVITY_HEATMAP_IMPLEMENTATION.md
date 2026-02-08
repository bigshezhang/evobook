# Activity Heatmap Implementation

> GitHub-style learning activity heatmap feature - 已完成实施

实施日期：2026-02-07

---

## ✅ 实施总结

### 核心功能
- **活动热力图**：类似 GitHub 日历的学习活动可视化
- **时区处理**：后端存储 UTC，前端按浏览器时区聚合显示
- **强度规则**：
  - 浅色 (light): 1-4 个 nodes 完成
  - 中色 (medium): 5-9 个 nodes 完成
  - 深色 (deep): 10+ 个 nodes 完成
- **显示范围**：最近 36 天（保持 12 列 × 3 行布局）

---

## 📦 后端实施

### 1. 数据库迁移
**文件**: `alembic/versions/20260207_230000_add_learning_activities_table.py`

新表 `learning_activities`:
```sql
- id (UUID, PK)
- user_id (UUID, FK -> profiles.id)
- course_map_id (UUID, FK -> course_maps.id)
- node_id (INTEGER)
- activity_type (TEXT): node_completed | quiz_passed | knowledge_card_finished
- completed_at (TIMESTAMPTZ): UTC 时间戳
- extra_data (JSONB): 可选元数据
- created_at (TIMESTAMPTZ)
```

索引：
- `idx_learning_activities_user_time` (user_id, completed_at DESC)
- `idx_learning_activities_user_course` (user_id, course_map_id)
- `idx_learning_activities_type` (activity_type)

**运行迁移**:
```bash
cd /Users/lazyman/Desktop/evobook_be
uv run alembic upgrade head
```

### 2. 领域模型
**文件**: `app/domain/models/learning_activity.py`

```python
class LearningActivity(Base):
    __tablename__ = "learning_activities"

    id: Mapped[UUID]
    user_id: Mapped[UUID]
    course_map_id: Mapped[UUID]
    node_id: Mapped[int]
    activity_type: Mapped[str]
    completed_at: Mapped[datetime]  # UTC
    extra_data: Mapped[dict | None]
    created_at: Mapped[datetime]
```

### 3. 服务层
**文件**: `app/domain/services/activity_service.py`

```python
class ActivityService:
    @staticmethod
    async def record_activity(
        user_id, course_map_id, node_id,
        activity_type, extra_data=None, db=None
    ) -> LearningActivity

    @staticmethod
    async def get_user_activities(
        user_id, days, db
    ) -> list[dict]  # 返回 UTC 时间戳
```

### 4. API 端点
**文件**: `app/api/v1/profile.py`

```
GET /api/v1/profile/learning-activities?days=180
```

**Response**:
```json
{
  "activities": [
    {
      "id": "uuid",
      "course_map_id": "uuid",
      "node_id": 5,
      "activity_type": "node_completed",
      "completed_at": "2026-02-07T14:35:20.123Z",
      "extra_data": null
    }
  ],
  "total": 156
}
```

### 5. 自动记录活动
**文件**: `app/api/v1/node_progress.py`

修改点：
- `PUT /api/v1/node-progress/{course_map_id}/{node_id}` - 单个 node 更新
- `PUT /api/v1/node-progress/{course_map_id}/batch` - 批量更新

当 `status == "completed"` 时，自动调用 `ActivityService.record_activity()`

---

## 🎨 前端实施

### 1. 时区聚合工具
**文件**: `utils/activityAggregator.ts`

```typescript
export function aggregateActivitiesToHeatmap(
  activities: Activity[],
  days: number = 36
): DayActivity[]
```

功能：
- 接收 UTC 时间戳数组
- 按浏览器本地时区转换成日期
- 聚合每日完成数量
- 计算强度等级 (none/light/medium/deep)
- 生成完整 36 天数据（包含空白天）

### 2. API 调用
**文件**: `utils/api.ts`

```typescript
export interface LearningActivity {
  id: string;
  course_map_id: string;
  node_id: number;
  activity_type: string;
  completed_at: string;  // ISO 8601 UTC
  extra_data: Record<string, any> | null;
}

export async function getLearningActivities(
  days: number = 180
): Promise<LearningActivitiesResponse>
```

### 3. UI 集成
**文件**: `views/main/CoursesDashboard.tsx`

修改点：
- ✅ 移除硬编码的活动图数据
- ✅ 调用 `getLearningActivities(180)` 获取 6 个月数据
- ✅ 使用 `aggregateActivitiesToHeatmap()` 聚合成 36 天
- ✅ 移除 "PAST 6 MONTHS" 文案
- ✅ 添加 hover 提示显示日期和完成数量
- ✅ 添加加载状态

颜色映射：
```tsx
const bgColor =
  day.intensity === 'deep' ? 'bg-secondary' :
  day.intensity === 'medium' ? 'bg-secondary/60' :
  day.intensity === 'light' ? 'bg-accent-purple/40' :
  'bg-[#F3F4F6]';
```

---

## 🔧 项目配置

### Cursor Rule
**文件**: `.cursor/rules/project-setup.mdc`

记录了项目使用 `uv` 作为包管理器：
```bash
uv run uvicorn app.main:app --reload --port 8000
uv run alembic upgrade head
uv run pytest
```

---

## 🧪 验证

### 1. 数据库
```bash
uv run python3 -c "from app.domain.models import LearningActivity; print('✅ Model OK')"
```

### 2. API 健康检查
```bash
curl http://localhost:8000/healthz
# Expected: {"ok": true, "ts": "..."}
```

### 3. 完整流程测试
1. 用户完成一个 node (前端调用 `PUT /api/v1/node-progress/{cid}/{nid}`)
2. 后端自动记录活动到 `learning_activities` 表
3. 前端刷新 Courses Dashboard
4. 调用 `GET /api/v1/profile/learning-activities`
5. 聚合并渲染热力图

---

## 📝 技术亮点

### 1. 职责分离
- **后端**：只负责存储 UTC 时间戳，不处理时区
- **前端**：负责时区转换、聚合、渲染

### 2. 性能优化
- 36 天数据量很小，前端聚合无性能问题
- 数据库索引优化查询 (user_id + completed_at DESC)
- 可选：未来可加 Redis 缓存

### 3. 扩展性
- `activity_type` 支持多种类型（node/quiz/boss）
- `extra_data` JSONB 字段可存储任意元数据
- 前端可轻松切换时区视图

### 4. SQLAlchemy 保留字段避免
- ❌ `metadata` (SQLAlchemy 保留)
- ✅ `extra_data` (替代方案)

---

## 🚀 后续优化建议

1. **缓存**：对频繁访问的活动数据加 Redis 缓存（TTL 5 分钟）
2. **分页**：当活动数据超大时，API 支持分页
3. **统计**：增加周统计、月统计聚合接口
4. **导出**：支持导出学习活动 CSV
5. **分享**：生成可分享的学习日历图片

---

## 🐛 已知问题 & 解决

### 问题 1: SQLAlchemy `metadata` 保留字段
**错误**: `Attribute name 'metadata' is reserved when using the Declarative API.`

**解决**: 将所有 `metadata` 字段重命名为 `extra_data`

**影响文件**:
- `app/domain/models/learning_activity.py`
- `alembic/versions/20260207_230000_add_learning_activities_table.py`
- `app/domain/services/activity_service.py`
- `app/api/v1/profile.py`
- `app/api/v1/node_progress.py`
- `utils/api.ts`

---

## ✅ 实施完成

所有任务已完成：
- [x] 创建 learning_activities 数据库迁移
- [x] 创建 LearningActivity 模型
- [x] 创建 ActivityService 服务层
- [x] 实现后端 API - GET /api/v1/profile/learning-activities
- [x] 在 mark_node_completed 时写入活动记录
- [x] 前端：创建 activityAggregator 工具函数
- [x] 前端：在 api.ts 添加 getLearningActivities
- [x] 前端：集成到 CoursesDashboard 组件

**部署状态**: ✅ 后端服务正常运行，前端已集成

**迁移状态**: ✅ 数据库迁移已成功执行
