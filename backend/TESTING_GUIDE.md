# 课程持久化修复 - 测试指南

## 🎯 修复目标

将课程数据从依赖 localStorage 改为完全从后端数据库读取，实现：
- ✅ 多课程管理
- ✅ 跨设备访问
- ✅ 数据持久化
- ✅ 用户隔离

---

## 🚀 快速测试

### 前提条件

1. **后端运行**
   ```bash
   cd ~/Desktop/evobook_be
   uv run uvicorn app.main:app --reload --port 8000
   ```

2. **前端运行**
   ```bash
   cd ~/Desktop/evobook
   npm run dev
   ```

3. **获取 Supabase Token**
   - 在浏览器打开前端应用
   - 登录 Supabase 账户
   - 打开 DevTools Console，执行：
     ```javascript
     (await window.supabase.auth.getSession()).data.session.access_token
     ```
   - 复制输出的 token

---

## 🧪 自动化测试

使用测试脚本验证所有 API：

```bash
cd ~/Desktop/evobook_be
AUTH_TOKEN='your-token-here' ./scripts/test_course_persistence.sh
```

**预期输出：**
```
=== 课程持久化 API 测试 ===

测试 1: 健康检查
{"ok":true,"ts":"2026-02-07T..."}
✓ 健康检查通过

测试 2: 生成课程
✓ 课程生成成功
  Course Map ID: 123e4567-e89b-12d3-a456-426614174000

测试 3: 获取课程列表
✓ 获取课程列表成功
  课程数量: 1

测试 4: 获取课程详情
✓ 获取课程详情成功
  主题: 测试课程 - Python编程
  节点数: 8

=== 所有测试通过 ===
```

---

## 🖱️ 手动测试流程

### 场景 1：生成并查看课程

1. **登录系统**
   - 访问 http://localhost:5173
   - 使用 Supabase 账户登录

2. **生成第一个课程**
   - 点击顶部 "Create" 按钮
   - 完成 onboarding 对话
   - 等待课程生成
   - 应该自动跳转到 Knowledge Tree

3. **返回主页查看**
   - 点击底部导航栏 "Courses"
   - **验证点：** "Mine" 标签下应该显示刚创建的课程
   - **验证点：** 课程卡片显示正确的主题、等级、模式

### 场景 2：多课程管理

1. **生成第二个课程**
   - 再次点击 "Create"
   - 选择不同的主题（如 "JavaScript 编程"）
   - 完成生成

2. **查看课程列表**
   - 返回 `/courses` 主页
   - **验证点：** 应该看到 2 个课程
   - **验证点：** 最新创建的在最上面

3. **分别进入两个课程**
   - 点击第一个课程 → 查看 Knowledge Tree
   - 返回主页，点击第二个课程 → 查看 Knowledge Tree
   - **验证点：** 两个课程的 DAG 结构应该不同

### 场景 3：数据持久化验证

1. **清除浏览器缓存**
   - 打开 DevTools (F12)
   - Application → Storage → Clear site data
   - 勾选 "Local storage"
   - 点击 "Clear site data"

2. **刷新页面**
   - **验证点：** 仍然保持登录状态（Supabase token 在 cookie）
   - 访问 `/courses` 主页
   - **验证点：** 应该仍然能看到所有课程

3. **跨浏览器测试（可选）**
   - 使用无痕模式或其他浏览器
   - 访问 http://localhost:5173
   - 登录同一账户
   - **验证点：** 能看到相同的课程列表

### 场景 4：课程详情加载

1. **从主页进入课程详情**
   - 在 `/courses` 点击任意课程
   - **验证点：** URL 应该是 `/course-detail?cid=<uuid>`
   - **验证点：** 页面显示课程名称、知识点标签

2. **进入知识树**
   - 点击 "Start Learning" 或类似按钮
   - **验证点：** URL 应该是 `/knowledge-tree?cid=<uuid>`
   - **验证点：** 显示完整的 DAG 节点
   - **验证点：** 节点可以点击

3. **点击节点进入学习**
   - 点击第一个节点
   - **验证点：** URL 应该是 `/knowledge-card?cid=<uuid>&nid=1`
   - **验证点：** 显示 Knowledge Card 内容

### 场景 5：错误处理

1. **测试无效的 course_map_id**
   - 手动访问：`http://localhost:5173/knowledge-tree?cid=invalid-uuid`
   - **验证点：** 显示友好的错误提示
   - **验证点：** 提供 "Back to Courses" 按钮

2. **测试未登录访问**
   - 退出登录
   - 访问 `/courses` 主页
   - **验证点：** 应该跳转到登录页或显示空状态

---

## 📊 数据库验证

### 查看生成的课程

```sql
-- 连接到 Postgres
psql $DATABASE_URL

-- 查看所有课程
SELECT 
  id,
  user_id,
  topic,
  level,
  mode,
  total_commitment_minutes,
  created_at
FROM course_maps
ORDER BY created_at DESC;

-- 查看某个用户的课程
SELECT 
  id,
  topic,
  level,
  mode,
  map_meta->>'course_name' as course_name,
  jsonb_array_length(nodes) as node_count
FROM course_maps
WHERE user_id = '<your-user-uuid>'
ORDER BY created_at DESC;

-- 查看课程详情
SELECT 
  topic,
  map_meta,
  nodes
FROM course_maps
WHERE id = '<course-map-uuid>';
```

---

## 🐛 常见问题排查

### 问题 1：主页显示 "Failed to load courses"

**可能原因：**
- 后端未运行
- 用户未登录
- Token 过期

**排查步骤：**
1. 检查后端日志：`http://localhost:8000/docs`
2. 检查浏览器 Console 是否有错误
3. 检查 Network 标签，查看 API 请求状态

### 问题 2：课程列表为空但数据库有数据

**可能原因：**
- 课程的 `user_id` 与当前登录用户不匹配
- Token 中的 `sub` 与数据库 `user_id` 不一致

**排查步骤：**
1. 在数据库查询：
   ```sql
   SELECT user_id FROM course_maps;
   ```
2. 在浏览器 Console 查看当前用户：
   ```javascript
   (await window.supabase.auth.getUser()).data.user.id
   ```
3. 对比两者是否一致

### 问题 3：Knowledge Tree 显示错误

**可能原因：**
- URL 中的 `cid` 参数丢失
- 课程不存在或已被删除
- 课程属于其他用户

**排查步骤：**
1. 检查 URL 是否包含 `?cid=<uuid>`
2. 在数据库验证课程是否存在
3. 检查浏览器 Console 错误信息

---

## 📝 测试检查清单

### 基础功能
- [ ] 用户可以登录
- [ ] 可以生成新课程
- [ ] 主页显示课程列表
- [ ] 点击课程进入详情页
- [ ] 可以进入 Knowledge Tree
- [ ] 可以点击节点进入学习

### 多课程支持
- [ ] 可以生成多个课程
- [ ] 主页显示所有课程
- [ ] 每个课程有独立的 DAG 结构
- [ ] 课程按时间倒序排列

### 数据持久化
- [ ] 清除 localStorage 后仍能看到课程
- [ ] 刷新页面后课程不丢失
- [ ] 换设备登录能看到相同课程（可选）

### 错误处理
- [ ] 无效 course_map_id 显示错误
- [ ] 网络错误有友好提示
- [ ] 未登录用户正确处理

### 用户隔离
- [ ] 不同用户只能看到自己的课程
- [ ] 无法访问其他用户的课程

---

## 🔄 回滚指令

如果测试失败需要回滚：

```bash
cd ~/Desktop/evobook

# 查看修改的文件
git status

# 回滚所有修改
git checkout -- utils/api.ts
git checkout -- views/main/CoursesDashboard.tsx
git checkout -- views/onboarding/GeneratingCourse.tsx
git checkout -- views/learning/KnowledgeTree.tsx
git checkout -- views/learning/CourseDetail.tsx
```

---

## 📚 相关文档

- [COURSE_PERSISTENCE_FIX.md](./COURSE_PERSISTENCE_FIX.md) - 详细的修复说明
- [docs/api-contract.md](./docs/api-contract.md) - API 接口文档
- [docs/db-schema.md](./docs/db-schema.md) - 数据库表结构

---

## ✅ 验收标准

修复成功的标志：

1. ✅ 用户可以创建多个课程
2. ✅ 所有课程都显示在主页列表
3. ✅ 清除 localStorage 后课程不丢失
4. ✅ 每个课程有独立的 DAG 和学习进度
5. ✅ 可以在不同设备上访问相同课程

---

## 🎉 测试成功后

如果所有测试通过，说明修复成功！

**下一步优化建议：**
1. 添加课程删除功能
2. 添加课程重命名功能
3. 将学习进度同步到后端
4. 添加客户端缓存（React Query）
5. 添加服务端缓存（Redis）
