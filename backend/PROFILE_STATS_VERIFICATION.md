# Profile Stats 快速验证指南

## 变更文件清单

### 后端（evobook_be）
1. ✅ `app/api/v1/profile.py` - 添加 `user_name` 和 `joined_date` 字段到 `/api/v1/profile/stats` 端点
2. ✅ `docs/api-contract.md` - 添加 Profile Stats 端点文档
3. ✅ `scripts/test_profile_stats.sh` - 新增测试脚本
4. ✅ `PROFILE_STATS_IMPLEMENTATION.md` - 完整实现文档

### 前端（evobook）
1. ✅ `utils/api.ts` - 更新 `ProfileStats` 接口定义
2. ✅ `views/main/ProfileView.tsx` - 替换硬编码数据为真实数据

---

## 快速验证（5分钟）

### 1. 启动后端
```bash
cd /Users/lazyman/Desktop/evobook_be
python3 -m uvicorn app.main:app --reload --port 8000
```

### 2. 测试健康检查
```bash
curl -s http://localhost:8000/healthz | jq '.ok'
# 预期输出: true
```

### 3. 获取认证 Token
在浏览器 Console 中执行：
```javascript
supabase.auth.getSession().then(r => console.log(r.data.session.access_token))
```

### 4. 测试 Profile Stats API
```bash
export TOKEN='paste-your-token-here'
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/profile/stats | jq '.'
```

**必须包含的字段：**
- ✅ `user_name` (string)
- ✅ `joined_date` (ISO 8601 格式，如 "2024-01-15T08:30:00.000000Z")
- ✅ `total_study_seconds` (int)
- ✅ `total_study_hours` (int)
- ✅ `completed_courses_count` (int)
- ✅ `global_rank` (int | null)

### 5. 启动前端并验证 UI
```bash
cd /Users/lazyman/Desktop/evobook
npm run dev
```

打开 http://localhost:5173/，登录后导航到 Profile 页面，检查：
- ✅ 用户名不是 "Alex Rivers"（显示真实用户名）
- ✅ 注册时间不是 "Joined January 2024"（显示真实注册时间）
- ✅ 学习时长显示真实数据
- ✅ 完成课程数显示真实数据
- ✅ 全局排名显示真实数据或 "N/A"

---

## 如果出现问题

### 后端返回 404 "PROFILE_NOT_FOUND"
原因：数据库中没有该用户的 Profile 记录

解决：
```sql
-- 检查 Profile 表
SELECT id, display_name, created_at FROM profiles WHERE id = 'your-user-id';

-- 如果记录不存在，需要先注册用户
```

### 前端显示 "EvoBook Learner"
原因：用户的 `display_name` 字段为空

解决：
```sql
-- 更新用户名
UPDATE profiles SET display_name = 'Your Name' WHERE id = 'your-user-id';
```

### 学习时长为 0
原因：`user_stats` 表中没有该用户的记录或学习时长为 0

这是正常的（新用户）。可以通过学习任意课程节点来增加学习时长（前端会自动发送 heartbeat）。

---

## 数据库查询（调试用）

### 查看所有用户 Profile
```sql
SELECT id, display_name, created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;
```

### 查看所有用户统计
```sql
SELECT
  p.display_name,
  us.total_study_seconds,
  us.completed_courses_count,
  us.mastered_nodes_count
FROM user_stats us
JOIN profiles p ON p.id = us.user_id
ORDER BY us.total_study_seconds DESC;
```

### 查看全局排名
```sql
SELECT
  p.display_name,
  us.total_study_seconds,
  ROW_NUMBER() OVER (ORDER BY us.total_study_seconds DESC) as rank
FROM user_stats us
JOIN profiles p ON p.id = us.user_id
WHERE us.total_study_seconds > 0
ORDER BY us.total_study_seconds DESC;
```

---

## 完成标志

当以下所有检查都通过时，任务验收完成：
- [x] 后端 API 返回正确的 JSON 结构（包含 user_name 和 joined_date）
- [x] 前端 Profile 页面显示真实的用户名
- [x] 前端 Profile 页面显示真实的注册时间（格式正确）
- [x] 无 Console 错误
- [x] 无 linter 错误
- [x] API 文档已更新
