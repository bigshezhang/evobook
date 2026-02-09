# Profile Stats 真实数据实现文档

## 任务概述

将 Profile 页面从硬编码的假数据改为显示真实的用户统计数据，包括：
- 用户名称（从 `display_name` 字段获取）
- 注册时间（从 `created_at` 字段获取）
- 学习时长（从 `user_stats` 表获取）
- 完成课程数（从 `user_stats` 表获取）
- 全局排名（通过 `RankingService` 计算）

---

## 实现清单

### 后端修改

#### 1. `/Users/lazyman/Desktop/evobook_be/app/api/v1/profile.py`

**变更内容：**
- ✅ 在 `ProfileStatsResponse` schema 中添加 `user_name` 和 `joined_date` 字段
- ✅ 修改 `get_profile_stats()` 端点实现：
  - 查询 `Profile` 表获取 `display_name` 和 `created_at`
  - 如果 `display_name` 为空，使用默认值 "EvoBook Learner"
  - 将 `created_at` 转换为 ISO 8601 格式返回
  - 添加 404 错误处理（Profile 不存在）

**关键代码：**
```python
# 1. 获取用户 Profile（包含 display_name 和 created_at）
from app.domain.models.profile import Profile
profile_stmt = select(Profile).where(Profile.id == user_id)
profile_result = await db.execute(profile_stmt)
profile = profile_result.scalar_one_or_none()

if profile is None:
    raise HTTPException(
        status_code=404,
        detail={"code": "PROFILE_NOT_FOUND", "message": "User profile not found"},
    )

# 返回响应时添加：
return {
    "user_name": profile.display_name or "EvoBook Learner",
    "joined_date": profile.created_at.isoformat(),
    # ... 其他字段
}
```

### 前端修改

#### 2. `/Users/lazyman/Desktop/evobook/utils/api.ts`

**变更内容：**
- ✅ 在 `ProfileStats` 接口中添加 `user_name` 和 `joined_date` 字段

**关键代码：**
```typescript
export interface ProfileStats {
  user_name: string;
  joined_date: string; // ISO 8601 format
  total_study_hours: number;
  total_study_seconds: number;
  completed_courses_count: number;
  mastered_nodes_count: number;
  global_rank: number | null;
  rank_percentile: number | null;
  total_users: number;
}
```

#### 3. `/Users/lazyman/Desktop/evobook/views/main/ProfileView.tsx`

**变更内容：**
- ✅ 用户名称：从硬编码 "Alex Rivers" 改为 `stats?.user_name`
- ✅ 注册时间：从硬编码 "Joined January 2024" 改为格式化 `stats?.joined_date`
- ✅ 邀请码：从硬编码 "STITCH99" 改为基于用户名动态生成
- ✅ 邀请海报：将硬编码的用户名改为 `stats?.user_name`

**关键代码：**
```typescript
// 用户名称
<h2 className="text-2xl font-black text-black uppercase tracking-tight">
  {loading ? 'Loading...' : stats?.user_name || 'EvoBook Learner'}
</h2>

// 注册时间
<p className="text-slate-400 text-sm font-bold opacity-80">
  {loading ? 'Loading...' : (stats?.joined_date ? (() => {
    const date = new Date(stats.joined_date);
    const year = date.getFullYear();
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    return `Joined ${month} ${year}`;
  })() : 'Joined recently')}
</p>

// 邀请码（动态生成）
<span className="text-slate-900 font-black">
  {stats?.user_name
    ? stats.user_name.toUpperCase().replace(/\s+/g, '').slice(0, 8) + '99'
    : 'EVOBOOK99'}
</span>
```

#### 4. `/Users/lazyman/Desktop/evobook_be/docs/api-contract.md`

**变更内容：**
- ✅ 添加 `GET /api/v1/profile/stats` 端点完整文档
- ✅ 包含请求头、响应字段、错误代码说明

---

## 测试脚本

创建了验证脚本：`/Users/lazyman/Desktop/evobook_be/scripts/test_profile_stats.sh`

**使用方法：**
```bash
cd /Users/lazyman/Desktop/evobook_be
export SUPABASE_TEST_TOKEN='your-token-here'
./scripts/test_profile_stats.sh
```

---

## 本地验收步骤

### 前置条件

1. **后端环境变量已配置：**
   ```bash
   cd /Users/lazyman/Desktop/evobook_be
   cp .env.example .env
   # 编辑 .env 文件，设置：
   # - DATABASE_URL
   # - LITELLM_MODEL
   # - SUPABASE_URL
   # - SUPABASE_JWT_SECRET
   # - 其他必要的 API keys
   ```

2. **数据库迁移已执行：**
   ```bash
   cd /Users/lazyman/Desktop/evobook_be
   alembic upgrade head
   ```

3. **有测试用户账号：**
   - 已注册并登录过 EvoBook 前端
   - Profile 表中存在该用户记录
   - （可选）user_stats 表中有该用户的学习数据

### 步骤 1：启动后端服务

```bash
cd /Users/lazyman/Desktop/evobook_be
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**预期输出：**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 步骤 2：测试健康检查

```bash
curl -s http://localhost:8000/healthz | jq '.'
```

**预期输出：**
```json
{
  "ok": true,
  "ts": "2026-02-08T12:00:00.000000Z"
}
```

### 步骤 3：测试 Profile Stats 端点

**获取认证 token：**
1. 在浏览器中打开 EvoBook 前端并登录
2. 打开浏览器开发者工具 Console
3. 执行以下代码获取 token：
   ```javascript
   supabase.auth.getSession().then(r => console.log(r.data.session.access_token))
   ```
4. 复制输出的 token

**使用 curl 测试：**
```bash
export TOKEN='your-token-here'

curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/profile/stats | jq '.'
```

**预期输出（示例）：**
```json
{
  "user_name": "Alex Rivers",
  "joined_date": "2024-01-15T08:30:00.000000Z",
  "total_study_hours": 2,
  "total_study_seconds": 5460,
  "completed_courses_count": 1,
  "mastered_nodes_count": 12,
  "global_rank": 1,
  "rank_percentile": 100,
  "total_users": 5
}
```

**字段验证清单：**
- ✅ `user_name`：应该是 Profile 表中的 `display_name`，或默认值 "EvoBook Learner"
- ✅ `joined_date`：应该是 ISO 8601 格式的时间戳（包含 'T' 和 'Z'）
- ✅ `total_study_hours`：应该是 `total_study_seconds` 向上取整除以 3600
- ✅ `total_study_seconds`：应该是非负整数
- ✅ `completed_courses_count`：应该是非负整数
- ✅ `mastered_nodes_count`：应该是非负整数
- ✅ `global_rank`：如果有学习数据应该是正整数，否则为 null
- ✅ `rank_percentile`：如果有排名应该是 0-100 之间的整数，否则为 null
- ✅ `total_users`：应该是系统中有学习时长统计的用户总数

### 步骤 4：启动前端并验证

```bash
cd /Users/lazyman/Desktop/evobook
npm run dev
```

**在浏览器中验证：**
1. 打开 http://localhost:5173/
2. 登录到 EvoBook
3. 导航到 Profile 页面
4. 检查以下内容：
   - ✅ 用户名应该显示真实的用户名（不是 "Alex Rivers"）
   - ✅ 注册时间应该显示真实的注册时间（不是 "Joined January 2024"）
   - ✅ 学习时长应该显示真实数据
   - ✅ 完成课程数应该显示真实数据
   - ✅ 全局排名应该显示真实数据（如果有数据）或 "N/A"
   - ✅ 邀请码应该基于用户名动态生成
   - ✅ 邀请海报中的用户名应该显示真实的用户名

### 步骤 5：测试边界情况

**测试新用户（无学习数据）：**
1. 注册一个新账号
2. 导航到 Profile 页面
3. 验证：
   - ✅ 学习时长显示为 0
   - ✅ 完成课程数显示为 0
   - ✅ 全局排名显示为 "N/A"

**测试无 display_name 的用户：**
1. 在数据库中将用户的 `display_name` 设置为 NULL：
   ```sql
   UPDATE profiles SET display_name = NULL WHERE id = 'your-user-id';
   ```
2. 刷新 Profile 页面
3. 验证：
   - ✅ 用户名显示为 "EvoBook Learner"
   - ✅ 邀请码显示为 "EVOBOOK99"

---

## 错误处理验证

### 测试 401 未认证

```bash
curl -s http://localhost:8000/api/v1/profile/stats | jq '.'
```

**预期输出：**
```json
{
  "detail": "Not authenticated"
}
```
HTTP Status: 401

### 测试 404 Profile 不存在

使用一个不存在的用户的 token（或手动修改 token payload），预期返回：

```json
{
  "error": {
    "code": "PROFILE_NOT_FOUND",
    "message": "User profile not found"
  }
}
```
HTTP Status: 404

---

## 数据库验证

### 检查 Profile 表

```sql
SELECT id, display_name, created_at
FROM profiles
WHERE id = 'your-user-id';
```

**预期结果：**
- `id`：用户 UUID
- `display_name`：用户名称（可能为 NULL）
- `created_at`：注册时间（timestamptz 类型）

### 检查 user_stats 表

```sql
SELECT user_id, total_study_seconds, completed_courses_count, mastered_nodes_count
FROM user_stats
WHERE user_id = 'your-user-id';
```

**预期结果：**
- 如果用户有学习记录，应该返回一条记录
- 如果用户没有学习记录，应该返回空结果（接口会返回默认值 0）

### 检查排名计算

```sql
-- 查看所有用户的学习时长排名
SELECT
  user_id,
  total_study_seconds,
  ROW_NUMBER() OVER (ORDER BY total_study_seconds DESC) as rank
FROM user_stats
WHERE total_study_seconds > 0
ORDER BY total_study_seconds DESC;
```

---

## 前后端数据流

```
前端 ProfileView.tsx
  ↓ (加载时调用)
前端 getProfileStats() API
  ↓ (HTTP GET + Bearer token)
后端 GET /api/v1/profile/stats
  ↓ (解析 JWT 获取 user_id)
后端 get_profile_stats() endpoint
  ↓ (查询数据库)
  ├─ Profile 表 → user_name, joined_date
  ├─ user_stats 表 → study time, completed courses
  └─ RankingService → global_rank, rank_percentile
  ↓ (返回 JSON)
前端 ProfileView.tsx
  ↓ (更新 UI)
显示真实数据
```

---

## 回滚计划

如果需要回滚到硬编码版本：

1. **后端回滚：**
   ```bash
   cd /Users/lazyman/Desktop/evobook_be
   git checkout HEAD~1 app/api/v1/profile.py
   git checkout HEAD~1 docs/api-contract.md
   ```

2. **前端回滚：**
   ```bash
   cd /Users/lazyman/Desktop/evobook
   git checkout HEAD~1 utils/api.ts
   git checkout HEAD~1 views/main/ProfileView.tsx
   ```

---

## 注意事项

1. **时区处理：**
   - 后端存储时间使用 UTC（`timestamptz`）
   - 后端 API 返回 ISO 8601 格式（包含 'Z' 后缀）
   - 前端接收到时间后，使用 `Date` 对象自动转换为用户本地时区

2. **用户名默认值：**
   - 如果 `display_name` 为 NULL 或空字符串，后端返回 "EvoBook Learner"
   - 前端也有相同的 fallback 逻辑作为双重保险

3. **学习数据为空的情况：**
   - 新用户没有 `user_stats` 记录时，接口返回默认值 0
   - 全局排名返回 null

4. **性能考虑：**
   - 当前实现对每个请求都查询数据库
   - 如果 Profile 页面访问频繁，可以考虑添加缓存（Redis）

---

## 后续优化建议

1. **添加缓存：**
   - 使用 Redis 缓存用户统计数据（TTL: 60秒）
   - 在学习时长更新时自动刷新缓存

2. **添加用户头像：**
   - 在 Profile 表添加 `avatar_url` 字段
   - 支持用户上传或选择头像

3. **添加更多统计维度：**
   - 连续学习天数
   - 本周学习时长
   - 最常学习的时间段

4. **优化排名计算：**
   - 使用物化视图预计算排名
   - 定期（每小时）更新排名而不是实时计算

---

## 验收标准

- [x] 后端 `/api/v1/profile/stats` 接口返回 `user_name` 和 `joined_date` 字段
- [x] 前端 Profile 页面显示真实的用户名称（不是硬编码）
- [x] 前端 Profile 页面显示真实的注册时间（格式：Joined Month Year）
- [x] 前端 Profile 页面显示真实的学习时长
- [x] 前端 Profile 页面显示真实的完成课程数
- [x] 前端 Profile 页面显示真实的全局排名
- [x] 邀请码基于用户名动态生成
- [x] 邀请海报显示真实的用户名
- [x] 新用户（无数据）显示默认值而不报错
- [x] 无 display_name 的用户显示 "EvoBook Learner"
- [x] API 文档已更新
- [x] 无 linter 错误

---

## 完成时间

2026-02-08

## 负责人

Cursor AI Agent (long-runner subagent)
