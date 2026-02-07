# localStorage 清理完成报告

## 🎯 修复目标

**彻底移除业务数据的 localStorage 依赖，改用后端 API**

---

## ✅ 已完成的修复

### 1. **CoursesDashboard.tsx** - 课程列表
- ❌ 之前：硬编码假数据
- ✅ 现在：调用 `getUserCourses()` API 从后端读取

### 2. **KnowledgeTree.tsx** - 知识树和节点进度
- ❌ 之前：从 localStorage 读取课程数据和节点进度
- ✅ 现在：
  - 调用 `getCourseDetail(cid)` 获取课程数据
  - 调用 `getNodeProgress(cid)` 获取节点进度
  - 完全移除 localStorage 依赖

### 3. **KnowledgeCard.tsx** - 学习卡片
- ❌ 之前：
  - 从 localStorage 读取课程数据
  - 手动更新 localStorage 中的节点进度
  - 存储 LEARNED_TOPICS 到 localStorage
- ✅ 现在：
  - 调用 `getCourseDetail(cid)` 获取课程数据
  - 调用 `updateNodeProgress()` API 更新节点状态
  - 移除 LEARNED_TOPICS 存储（改由后端推导）

### 4. **QuizView.tsx** - 测验页面
- ❌ 之前：从 localStorage 读取 LEARNED_TOPICS
- ✅ 现在：
  - 调用 `getNodeProgress()` 获取已完成节点
  - 从课程数据推导学习过的主题

### 5. **GeneratingCourse.tsx** - 课程生成
- ❌ 之前：保存课程到 localStorage
- ✅ 现在：只保存到后端，不存 localStorage

### 6. **CourseDetail.tsx** - 课程详情
- ❌ 之前：从 localStorage 读取
- ✅ 现在：调用 `getCourseDetail(cid)` API

---

## 📊 localStorage 使用情况对比

### 修复前
```
❌ COURSE_MAP          - 存储完整课程数据
❌ CURRENT_NODE        - 存储当前节点
❌ LEARNED_TOPICS      - 存储学习历史
❌ NODE_PROGRESS       - 存储节点进度
✅ ONBOARDING_DATA     - Onboarding 会话数据（合理）
✅ QA_HISTORY_PREFIX   - QA 交互历史（合理）
```

### 修复后
```
✅ ONBOARDING_DATA     - Onboarding 会话数据（临时）
✅ QA_HISTORY_PREFIX   - QA 交互历史（临时交互状态）
✅ evo_onboarding_completed - UI 状态标记（可选优化）
✅ evo_main_course     - UI 状态（可选优化）
```

---

## 🔄 数据流变化

### 课程数据流
```
修复前：
生成课程 → localStorage → 前端读取
❌ 问题：换设备丢失、多课程覆盖

修复后：
生成课程 → 后端 DB → 前端 API 调用
✅ 优势：跨设备同步、多课程支持、持久化
```

### 节点进度流
```
修复前：
学习完成 → localStorage 手动更新 → 前端读取
❌ 问题：不同步、无法跨设备

修复后：
学习完成 → updateNodeProgress API → 后端 DB
下次访问 → getNodeProgress API → 前端显示
✅ 优势：实时同步、跨设备、可追溯
```

### 学习历史流（Quiz）
```
修复前：
完成节点 → 存储 LEARNED_TOPICS 到 localStorage
Quiz → 读取 localStorage

修复后：
完成节点 → updateNodeProgress('completed')
Quiz → getNodeProgress → 筛选 completed 节点 → 推导学习主题
✅ 优势：单一数据源、无需重复存储
```

---

## 🎨 新增的 API 函数

### 前端 API (utils/api.ts)

#### 课程管理
```typescript
getUserCourses(): Promise<CourseListResponse>
getCourseDetail(courseMapId: string): Promise<CourseDetailResponse>
```

#### 节点进度
```typescript
getNodeProgress(courseMapId: string): Promise<GetProgressResponse>
updateNodeProgress(courseMapId, nodeId, status): Promise<NodeProgressItem>
batchUpdateNodeProgress(courseMapId, updates): Promise<GetProgressResponse>
```

---

## 📋 后端 API 端点（已有）

### 课程
- `GET /api/v1/course-map/list` - 获取用户课程列表
- `GET /api/v1/course-map/{id}` - 获取课程详情
- `POST /api/v1/course-map/generate` - 生成新课程

### 节点进度
- `GET /api/v1/node-progress/{course_map_id}` - 获取所有节点进度
- `PUT /api/v1/node-progress/{course_map_id}/{node_id}` - 更新单个节点
- `PUT /api/v1/node-progress/{course_map_id}/batch` - 批量更新

### 内容生成
- `POST /api/v1/node-content/knowledge-card` - 生成知识卡片
- `POST /api/v1/node-content/clarification` - 生成澄清
- `POST /api/v1/node-content/qa-detail` - 生成详细解答

---

## 🧹 已废弃的 STORAGE_KEYS

以下 keys 已标记为 `@deprecated`，不应再使用：

```typescript
❌ COURSE_MAP       - 使用 getCourseDetail() API
❌ CURRENT_NODE     - 使用 URL 参数 (cid, nid)
❌ LEARNED_TOPICS   - 从 getNodeProgress() 推导
❌ NODE_PROGRESS    - 使用 getNodeProgress() API
```

---

## ✅ 合理保留的 localStorage 使用

### 1. Onboarding 会话数据
**位置**: `AssessmentChat.tsx`
**用途**: 临时存储 onboarding 会话 ID 和选择的主题
**原因**: Onboarding 是一次性流程，不需要持久化到数据库

```typescript
localStorage.setItem('evo_onboarding_data', JSON.stringify(data));
localStorage.setItem('evo_onboarding_completed', 'true');
```

### 2. QA 交互历史
**位置**: `ClarificationSection.tsx`
**用途**: 存储每个节点的问答历史
**原因**: QA 是临时的交互状态，用于提升 UX（避免重复提问）

```typescript
const key = `${STORAGE_KEYS.QA_HISTORY_PREFIX}${courseMapId}_${nodeId}`;
localStorage.setItem(key, JSON.stringify(qaHistory));
```

### 3. UI 状态标记
**位置**: `CourseDetail.tsx`
**用途**: `evo_main_course`, `evo_onboarding_completed`
**原因**: 纯 UI 状态，不是业务数据

---

## 🔍 验证清单

### 功能验证
- [x] 课程列表正确显示所有用户课程
- [x] 可以创建多个课程
- [x] 清除 localStorage 后课程不丢失
- [x] Knowledge Tree 正确显示节点和进度
- [x] 节点完成后进度正确更新到后端
- [x] Quiz 正确读取学习过的节点
- [x] 跨设备访问看到相同数据

### 代码验证
- [x] 所有业务数据调用后端 API
- [x] 没有使用废弃的 STORAGE_KEYS
- [x] localStorage 只用于临时状态
- [x] 所有 API 调用有错误处理
- [x] No linter errors

---

## 🧪 测试步骤

### 1. 基本流程测试
```bash
1. 登录系统
2. 创建第一个课程
3. 返回主页，验证课程显示
4. 进入 Knowledge Tree
5. 完成一个节点
6. 进入 Quiz，验证能看到学习过的节点
```

### 2. 持久化测试
```bash
1. 清除浏览器 localStorage (F12 → Application → Clear)
2. 刷新页面
3. 验证课程列表仍然存在
4. 验证节点进度仍然正确
```

### 3. 多课程测试
```bash
1. 创建 3 个不同主题的课程
2. 验证主页显示 3 个课程
3. 分别进入不同课程的 Knowledge Tree
4. 验证 DAG 结构互不影响
5. 验证进度独立追踪
```

### 4. API 测试
```bash
# 获取课程列表
curl http://localhost:8000/api/v1/course-map/list \
  -H "Authorization: Bearer $TOKEN"

# 获取节点进度
curl http://localhost:8000/api/v1/node-progress/$COURSE_ID \
  -H "Authorization: Bearer $TOKEN"

# 更新节点状态
curl -X PUT http://localhost:8000/api/v1/node-progress/$COURSE_ID/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}'
```

---

## 🚀 性能优化建议（后续）

### 1. 添加客户端缓存
```typescript
import { useQuery } from '@tanstack/react-query';

const { data: courses } = useQuery({
  queryKey: ['courses'],
  queryFn: getUserCourses,
  staleTime: 5 * 60 * 1000, // 5分钟缓存
});
```

### 2. 添加服务端缓存
- Redis 缓存课程列表（TTL: 5分钟）
- 在课程更新时清除缓存
- 减少数据库查询压力

### 3. 增量加载
- 课程列表分页（当课程数 > 20）
- 节点进度懒加载
- Knowledge Card 内容预加载

---

## 📝 遗留问题（可选后续优化）

### 1. sessionStorage 缓存
**位置**: `KnowledgeCard.tsx`
**现状**: 使用 sessionStorage 缓存 Knowledge Card 内容
**建议**: 保持现状（sessionStorage 适合页面级缓存）

### 2. QA 历史持久化（可选）
**现状**: QA 历史存在 localStorage
**可选优化**: 创建后端 API 持久化 QA 历史
**优先级**: 低（QA 历史是临时交互状态）

### 3. Onboarding 数据清理
**现状**: Onboarding 完成后数据仍在 localStorage
**可选优化**: 课程生成后清除 onboarding 数据
**优先级**: 低（数据量小，不影响功能）

---

## 🎉 修复总结

### 已实现
✅ **所有业务数据完全从后端读取**
✅ **节点进度实时同步到后端**
✅ **支持多课程、跨设备、持久化**
✅ **localStorage 只用于临时 UI 状态**
✅ **代码清晰、易维护**

### 优势
1. **数据一致性**: 单一数据源（后端数据库）
2. **跨设备支持**: 任何设备登录都能看到相同数据
3. **多课程支持**: 无限制创建课程
4. **数据持久化**: 数据永久保存，不会丢失
5. **可扩展性**: 易于添加新功能（如进度分析、学习报告）

---

## 📚 相关文档

- [COURSE_PERSISTENCE_FIX.md](./COURSE_PERSISTENCE_FIX.md) - 课程持久化修复详情
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - 测试指南
- [docs/api-contract.md](./docs/api-contract.md) - API 接口文档
- [docs/db-schema.md](./docs/db-schema.md) - 数据库表结构
