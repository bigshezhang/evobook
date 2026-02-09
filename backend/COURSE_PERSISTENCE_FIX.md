# 课程持久化修复总结

## 修复内容

### 1. 前端 API 层 (`evobook/utils/api.ts`)

#### 新增类型定义
```typescript
- CourseListItem: 课程列表项
- CourseListResponse: 课程列表响应
- CourseDetailResponse: 课程详情响应
```

#### 新增 API 函数
```typescript
- getUserCourses(): 获取用户所有课程列表
- getCourseDetail(courseMapId): 获取单个课程详情
```

### 2. 主页面 (`evobook/views/main/CoursesDashboard.tsx`)

#### 修改内容
- ✅ 从后端 API 读取用户真实课程，替代硬编码假数据
- ✅ 添加加载状态处理
- ✅ 添加错误状态处理
- ✅ 添加空状态提示（无课程时）
- ✅ 动态渲染用户课程列表
- ✅ 显示课程的 topic、level、mode 信息

### 3. 课程生成页 (`evobook/views/onboarding/GeneratingCourse.tsx`)

#### 修改内容
- ✅ 移除保存到 localStorage 的逻辑
- ✅ 课程数据完全由后端持久化
- ✅ 仍然导航到 knowledge-tree，但通过 URL 参数传递 course_map_id

### 4. 知识树页面 (`evobook/views/learning/KnowledgeTree.tsx`)

#### 修改内容
- ✅ 从 localStorage 改为调用 `getCourseDetail(cid)` API
- ✅ 添加加载状态
- ✅ 添加错误处理
- ✅ 移除对 `STORAGE_KEYS.CURRENT_NODE` 的依赖
- ✅ 使用 URL 参数 `cid` 作为课程唯一标识
- ✅ 节点进度改为按 `course_map_id` 独立存储

### 5. 课程详情页 (`evobook/views/learning/CourseDetail.tsx`)

#### 修改内容
- ✅ 从 localStorage 改为调用 `getCourseDetail(cid)` API
- ✅ 添加加载状态
- ✅ 基于 URL 参数 `cid` 加载课程

---

## 数据流对比

### 修复前（有问题）
```
用户生成课程
    ↓
后端保存到 DB + 前端保存到 localStorage
    ↓
前端页面只读 localStorage
    ↓
问题：换设备后丢失 / 多课程覆盖
```

### 修复后（正确）
```
用户生成课程
    ↓
后端保存到 DB (with user_id)
    ↓
主页调用 /api/v1/course-map/list 读取所有课程
    ↓
学习页面调用 /api/v1/course-map/{id} 读取单个课程
    ↓
结果：支持多设备 / 多课程 / 持久化
```

---

## 测试步骤

### 前置条件
1. 确保后端运行在 `http://localhost:8000`
2. 确保前端配置了正确的 `VITE_API_BASE_URL`
3. 确保已登录 Supabase 账户

### 测试场景 1：首次生成课程

1. **登录系统**
   - 访问前端，使用 Supabase 账户登录

2. **生成第一个课程**
   - 点击 "Create" 进入 onboarding
   - 完成对话流程
   - 选择 topic, level 等
   - 等待课程生成

3. **验证主页显示**
   - 导航回 `/courses`
   - 验证 "Mine" 标签下显示刚生成的课程
   - 课程应显示正确的 topic、level、mode

### 测试场景 2：多课程支持

1. **生成第二个课程**
   - 再次点击 "Create"
   - 生成另一个不同主题的课程

2. **验证主页列表**
   - 返回 `/courses`
   - 应该看到两个课程
   - 按创建时间倒序排列（最新的在上面）

3. **验证课程独立性**
   - 点击第一个课程 → Knowledge Tree
   - 返回主页
   - 点击第二个课程 → Knowledge Tree
   - 两个课程应该有独立的 DAG 结构

### 测试场景 3：跨设备持久化

1. **清除 localStorage**
   - 打开浏览器 DevTools
   - Application → Local Storage → 清空

2. **刷新页面**
   - 保持登录状态
   - 访问 `/courses`
   - 应该仍然能看到之前创建的所有课程

3. **换浏览器测试（可选）**
   - 使用无痕模式或其他浏览器
   - 登录同一账户
   - 应该能看到相同的课程列表

### 测试场景 4：课程详情加载

1. **从主页进入课程**
   - 在 `/courses` 页面点击任意课程

2. **验证详情页**
   - URL 应该包含 `?cid=<uuid>`
   - 页面应该正确显示课程名称、主题、知识点

3. **验证知识树**
   - 点击进入 Knowledge Tree
   - URL 应该包含 `?cid=<uuid>`
   - 应该显示完整的 DAG 结构
   - 节点可点击

### 测试场景 5：错误处理

1. **测试无效 course_map_id**
   - 手动访问 `/knowledge-tree?cid=invalid-uuid`
   - 应该显示友好的错误提示
   - 提供返回主页的按钮

2. **测试网络错误**
   - 关闭后端服务
   - 刷新 `/courses` 页面
   - 应该显示错误信息

---

## 后端 API 端点验证

### 1. 生成课程
```bash
curl -X POST http://localhost:8000/api/v1/course-map/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-supabase-token>" \
  -d '{
    "topic": "Python编程",
    "level": "Beginner",
    "focus": "快速入门",
    "verified_concept": "Python基础",
    "mode": "Fast",
    "total_commitment_minutes": 120
  }'
```

### 2. 获取课程列表
```bash
curl http://localhost:8000/api/v1/course-map/list \
  -H "Authorization: Bearer <your-supabase-token>"
```

### 3. 获取单个课程
```bash
curl http://localhost:8000/api/v1/course-map/<course-map-id> \
  -H "Authorization: Bearer <your-supabase-token>"
```

---

## 已知限制

### 暂未修改的部分
以下页面仍使用 localStorage 存储中间状态（不影响主流程）：

1. **KnowledgeCard.tsx**
   - 仍从 localStorage 读取部分数据
   - 原因：涉及复杂的页面缓存和 QA 历史管理
   - 计划：后续迁移到后端 API

2. **QuizView.tsx**
   - 仍使用 localStorage 存储 learned_topics
   - 原因：Quiz 需要跨节点的学习历史
   - 计划：后续添加 user_progress API

### localStorage 仍在使用的场景
- 节点进度状态（按 course_map_id 隔离）
- QA 历史记录（按 node 隔离）
- 当前正在学习的节点（临时状态）

---

## 数据库验证

### 检查课程是否正确保存
```sql
-- 查看用户的所有课程
SELECT 
  id, 
  topic, 
  level, 
  mode, 
  created_at,
  user_id
FROM course_maps
WHERE user_id = '<your-user-uuid>'
ORDER BY created_at DESC;

-- 查看课程详情
SELECT 
  topic,
  map_meta->>'course_name' as course_name,
  jsonb_array_length(nodes) as node_count
FROM course_maps
WHERE id = '<course-map-uuid>';
```

---

## 回滚方案

如果出现问题需要回滚：

1. **恢复 CoursesDashboard.tsx**
   - 使用 git checkout 恢复硬编码数据

2. **恢复 GeneratingCourse.tsx**
   - 恢复保存到 localStorage 的代码

3. **恢复 KnowledgeTree.tsx**
   - 恢复从 localStorage 读取的逻辑

---

## 性能优化建议（后续）

### 1. 添加客户端缓存
```typescript
// 使用 React Query
import { useQuery } from '@tanstack/react-query';

const { data: courses } = useQuery({
  queryKey: ['courses'],
  queryFn: getUserCourses,
  staleTime: 5 * 60 * 1000, // 5分钟缓存
});
```

### 2. 添加服务端缓存
- 对于频繁访问的课程列表，考虑 Redis 缓存
- TTL: 5-10 分钟
- 在课程更新时清除缓存

### 3. 分页支持
- 当用户课程数量 > 20 时，添加分页
- 支持按创建时间、主题等排序

---

## 相关文件

### 前端修改
- `evobook/utils/api.ts` - API 函数定义
- `evobook/views/main/CoursesDashboard.tsx` - 主页
- `evobook/views/onboarding/GeneratingCourse.tsx` - 生成页
- `evobook/views/learning/KnowledgeTree.tsx` - 知识树
- `evobook/views/learning/CourseDetail.tsx` - 课程详情

### 后端参考
- `evobook_be/app/api/v1/course_map.py` - 课程 API 端点
- `evobook_be/app/domain/models/course_map.py` - 课程模型
- `evobook_be/app/domain/services/course_map_service.py` - 课程服务

---

## 总结

✅ **已解决的问题**
1. 前端不再依赖 localStorage 存储课程数据
2. 支持多课程管理
3. 支持跨设备访问
4. 数据持久化到后端数据库
5. 正确关联用户账户

⚠️ **待优化的点**
1. 添加课程删除功能
2. 添加课程重命名功能
3. 添加学习进度同步到后端
4. KnowledgeCard 等页面迁移到完全后端驱动
