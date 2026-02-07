# 用户活跃课程功能实施文档

## 功能概述

实现用户活跃课程管理功能，解决底部导航学习按钮路由错误问题。

## 业务逻辑

### 活跃课程优先级

用户点击学习按钮时，系统按以下优先级返回课程：

1. **用户设置的活跃课程** (`active_course_map_id`) - 用户手动设置的首页课程
2. **最后访问的课程** (`last_accessed_course_map_id`) - 最近访问过的课程
3. **最新创建的课程** - 按 `created_at` DESC 排序的第一个课程
4. **无课程** - 返回 null，前端跳转到课程列表页

### 自动更新逻辑

- **课程生成时**: 新生成的课程自动设置为用户的活跃课程
- **课程访问时**: 访问课程详情时自动更新最后访问记录

## 数据库变更

### Migration: `20260207_220653_add_active_course_fields_to_profiles.py`

在 `profiles` 表添加以下字段:

```sql
-- 用户设置的活跃课程
active_course_map_id UUID NULL,
  FOREIGN KEY (active_course_map_id) REFERENCES course_maps(id) ON DELETE SET NULL

-- 最后访问的课程
last_accessed_course_map_id UUID NULL,
  FOREIGN KEY (last_accessed_course_map_id) REFERENCES course_maps(id) ON DELETE SET NULL

-- 最后访问时间
last_accessed_at TIMESTAMP WITH TIME ZONE NULL
```

索引：
- `idx_profiles_active_course` on `active_course_map_id`
- `idx_profiles_last_accessed_course` on `last_accessed_course_map_id`

## 后端实现

### 1. 模型层 (`app/domain/models/profile.py`)

添加三个新字段的 SQLAlchemy 映射。

### 2. 服务层 (`app/domain/services/profile_service.py`)

新增方法：

- `get_active_course_map_id(user_id, db)` - 获取活跃课程 ID（按优先级）
- `set_active_course_map(user_id, course_map_id, db)` - 设置活跃课程
- `update_last_accessed_course(user_id, course_map_id, db)` - 更新最后访问记录

### 3. API 层 (`app/api/v1/profile.py`)

新增端点：

#### `GET /api/v1/profile/active-course`

返回活跃课程 ID。

**Response:**
```json
{
  "course_map_id": "uuid" | null
}
```

#### `PUT /api/v1/profile/active-course`

设置活跃课程。

**Request:**
```json
{
  "course_map_id": "uuid"
}
```

**Response:** 204 No Content

### 4. 自动更新集成 (`app/api/v1/course_map.py`)

#### `POST /api/v1/course-map/generate`

生成课程后，自动调用 `ProfileService.set_active_course_map()` 设置为活跃课程。

#### `GET /api/v1/course-map/{course_map_id}`

访问课程详情时，自动调用 `ProfileService.update_last_accessed_course()` 更新访问记录。

## 前端实现

### 1. API 客户端 (`utils/api.ts`)

新增函数：

```typescript
// 获取活跃课程
export async function getActiveCourse(): Promise<{ course_map_id: string | null }>

// 设置活跃课程
export async function setActiveCourse(courseMapId: string): Promise<void>
```

废弃函数（保留兼容）：

```typescript
// @deprecated 使用 getActiveCourse() 替代
export function getStoredCourseMapId(): string | null
```

### 2. 底部导航 (`components/BottomNav.tsx`)

修改学习按钮的点击逻辑：

```typescript
const handleLearningClick = async () => {
  try {
    const { course_map_id } = await getActiveCourse();
    
    if (course_map_id) {
      // 有课程 → 跳转到知识树
      navigate(buildLearningPath('/knowledge-tree', { cid: course_map_id }));
    } else {
      // 无课程 → 跳转到课程列表
      navigate('/courses');
    }
  } catch (error) {
    console.error('Failed to get active course:', error);
    navigate('/courses');
  }
};
```

## 验收测试

### 前置条件

1. 后端服务运行: `cd evobook_be && ./scripts/dev.sh`
2. 数据库已迁移: `alembic upgrade head`
3. 获取有效的 JWT token (登录后从 Supabase 获取)

### 测试步骤

#### 1. 自动化测试脚本

```bash
cd evobook_be
export AUTH_TOKEN="your_jwt_token_here"
./scripts/test_active_course.sh
```

#### 2. 手动测试场景

**场景 A: 无课程用户**

1. 登录新用户（无任何课程）
2. 点击底部导航"学习"按钮
3. 预期：跳转到 `/courses` 课程列表页

**场景 B: 新增课程后**

1. 完成 Onboarding 并生成课程
2. 点击底部导航"学习"按钮
3. 预期：跳转到新生成课程的知识树页面

**场景 C: 访问某个课程后**

1. 在课程列表中点击任意课程
2. 查看课程详情
3. 返回首页，点击底部导航"学习"按钮
4. 预期：跳转到刚才访问的课程

**场景 D: 多个课程切换**

1. 拥有多个课程
2. 访问课程 A
3. 点击学习按钮 → 应跳转到课程 A
4. 访问课程 B
5. 点击学习按钮 → 应跳转到课程 B

#### 3. API 端点测试

```bash
# 获取活跃课程
curl -X GET http://localhost:8000/api/v1/profile/active-course \
  -H "Authorization: Bearer $AUTH_TOKEN"

# 设置活跃课程
curl -X PUT http://localhost:8000/api/v1/profile/active-course \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"course_map_id":"your-course-uuid-here"}'
```

## 验收标准

- ✅ 点击学习按钮不再报错 "No course ID provided"
- ✅ 新增课程后，点击学习按钮跳转到新课程
- ✅ 访问某个课程后，点击学习按钮跳转到该课程
- ✅ 没有课程时，跳转到课程列表页
- ✅ 数据库迁移成功执行
- ✅ 所有 API 端点返回正确的响应格式
- ✅ 无 linter 错误

## 技术约束遵守情况

- ✅ 代码注释使用中文
- ✅ Log 消息使用英文
- ✅ Python 命令使用 `python3`
- ✅ 遵循 DDD 架构分层
- ✅ 所有错误返回统一 JSON 格式
- ✅ 数据库操作使用 SQLAlchemy
- ✅ 完整的类型提示

## 后续改进建议

1. **手动设置首页课程**: 在课程列表页添加"设为首页课程"按钮
2. **其他组件迁移**: 将 DiscoveryList, CoursesDashboard, TravelBoard 中的 `getStoredCourseMapId()` 替换为 `getActiveCourse()`
3. **缓存优化**: 前端可以缓存 active_course_id，减少 API 调用
4. **离线支持**: 在网络错误时 fallback 到 localStorage

## 相关文件

### 后端
- `alembic/versions/20260207_220653_add_active_course_fields_to_profiles.py`
- `app/domain/models/profile.py`
- `app/domain/services/profile_service.py`
- `app/api/v1/profile.py`
- `app/api/v1/course_map.py`
- `scripts/test_active_course.sh`

### 前端
- `utils/api.ts`
- `components/BottomNav.tsx`

## 版本信息

- 实施日期: 2026-02-07
- Migration Revision: `7cd1090b7360`
- 涉及表: `profiles`
