# Discovery 功能实现总结

## 概述

实现了 Discovery 功能，允许用户浏览精选课程并快速启动 onboarding 流程。

## 实现内容

### 1. 数据库表

创建了 `discovery_courses` 表：
- **preset_id**: 唯一标识（如 `quantum-physics-intro`）
- **基础信息**: title, description, image_url
- **分类**: category (recommended, popular, friends)
- **评分**: rating (Decimal 3,1)
- **种子上下文**: seed_context (JSONB) - 包含 onboarding 预设数据
- **统计字段**: view_count, start_count, completion_count
- **状态**: is_active (是否显示)

迁移文件: `alembic/versions/20260208_230000_create_discovery_courses_table.py`

### 2. 数据模型

文件: `app/domain/models/discovery_course.py`

```python
class DiscoveryCourse(Base):
    __tablename__ = "discovery_courses"
    # ... 字段定义
```

### 3. API 端点

文件: `app/api/v1/discovery.py`

#### GET `/api/v1/discovery/courses`
- 参数: `category` (可选) - 按分类过滤
- 返回: 课程列表 + 总数

#### POST `/api/v1/discovery/courses/{preset_id}/start`
- 标记课程为"已启动"（增加 start_count）
- 返回: seed_context 用于 onboarding

#### GET `/api/v1/discovery/courses/{preset_id}`
- 获取单个课程详情

### 4. Onboarding 集成

修改了 `app/api/v1/onboarding.py` 和 `app/domain/services/onboarding_service.py`：

- **新参数**: `discovery_preset_id` - 在 onboarding 请求中指定 discovery 课程
- **自动注入**: 从 discovery 课程读取 seed_context 并注入到 onboarding 上下文
- **跳过探索阶段**: 自动设置 initial_topic，直接进入难度校准

上下文注入示例：
```
# Discovery Course Context (Pre-selected)
User is interested in: Quantum Physics
Suggested Level: Beginner
Key Concepts: wave-particle duality, superposition, ...
Learning Goal: Understanding fundamental principles...
```

### 5. Seed 脚本

文件: `scripts/seed_discovery_courses.py`

根据前端 mock 数据创建了 6 个精选课程：
1. Quantum Physics for Beginners (recommended)
2. Modern UI Principles (recommended)
3. Generative Art AI (popular)
4. Data Science Flow (popular)
5. Neural Architecture (popular)
6. Creative Coding 101 (friends)

## 使用流程

### 前端集成流程（已实现）

1. **用户浏览 Discovery**
   - 前端显示课程列表（图片、标题、评分）
   - 图片/标题不可点击（Discovery 课程只是模板）
   - 只有加号按钮可点击

2. **用户点击加号（开始学习）**
   ```typescript
   // DiscoveryList.tsx
   const handleAddCourse = (presetId: string) => {
     navigate(`${ROUTES.ASSESSMENT}?preset=${presetId}`);
   };
   ```

3. **跳转到 Onboarding 页面**
   - URL 参数携带 `preset=quantum-physics-intro`
   - AssessmentChat 组件读取 preset 参数

4. **Onboarding 自动注入 Discovery 上下文**
   ```typescript
   // AssessmentChat.tsx
   const discoveryPresetId = searchParams.get('preset');

   const response = await onboardingNext({
     initial_topic: topic || undefined,
     discovery_preset_id: discoveryPresetId || undefined,
   });
   ```

5. **后端处理**
   - 从数据库读取 discovery_courses 的 seed_context
   - 注入到 onboarding prompt 上下文
   - 跳过 Phase 1（话题探索），直接进入 Phase 2（难度校准）
   - 更快的 onboarding 体验（3-5轮 vs 8-10轮）

### 用户体验流程

```
用户在 Discovery 浏览课程
    ↓
点击"Quantum Physics"的加号
    ↓
跳转到 /assessment?preset=quantum-physics-intro
    ↓
Onboarding 开场："Great! You want to learn Quantum Physics..."
    ↓
直接提问难度（跳过话题探索）
    ↓
选择学习模式 → 完成 onboarding
    ↓
生成个性化课程
```

## 验证测试

### 后端测试（已完成 ✓）

```bash
# 1. 迁移数据库
uv run alembic upgrade head

# 2. 插入课程数据
uv run python3 scripts/seed_discovery_courses.py
# 输出: ✨ Seeding complete! Added 6 discovery courses.

# 3. 启动后端
uv run uvicorn app.main:app --port 8000 --reload

# 4. 测试 discovery API
curl http://localhost:8000/api/v1/discovery/courses?category=recommended
# 返回 2 个 recommended 课程

# 5. 测试 onboarding 集成
curl -X POST http://localhost:8000/api/v1/onboarding/next \
  -H "Content-Type: application/json" \
  -d '{"discovery_preset_id": "quantum-physics-intro"}'
# 返回: "Great! You want to learn Quantum Physics..."
```

### 前端测试步骤

1. 打开 Discovery 页面
2. 浏览课程（确认图片/标题不可点击）
3. 点击任意课程的加号按钮
4. 验证跳转到 `/assessment?preset=xxx`
5. 确认 onboarding 对话直接从难度确认开始（跳过话题探索）

## seed_context 格式

每个 discovery 课程的 seed_context 包含：
```json
{
  "topic": "Quantum Physics",
  "suggested_level": "Beginner",
  "key_concepts": "wave-particle duality, superposition, ...",
  "focus": "Understanding fundamental principles...",
  "verified_concept": "Schrödinger's cat thought experiment"
}
```

## 前端改动总结

### 1. DiscoveryList.tsx
- ✅ 添加 `presetId` 到 mockCourses
- ✅ 移除图片/标题的点击事件和 cursor-pointer
- ✅ `handleAddCourse` 跳转到 `/assessment?preset=xxx`
- ✅ 移除 SuccessFeedbackPill（不再需要）

### 2. AssessmentChat.tsx
- ✅ 导入 `useSearchParams`
- ✅ 读取 URL 参数 `preset`
- ✅ 传递 `discovery_preset_id` 给后端 API

### 3. utils/api.ts
- ✅ `OnboardingNextRequest` 接口添加 `discovery_preset_id` 字段

## 未来扩展

- [ ] 从后端 API 动态加载 Discovery 课程（替换 mockCourses）
- [ ] 用户收藏功能
- [ ] 课程完成率追踪（需要在 course_maps 表增加 discovery_source_id）
- [ ] 用户贡献课程（需要审核流程）
- [ ] A/B 测试不同的课程描述和图片
- [ ] 推荐算法（基于用户历史）
- [ ] 课程搜索功能
