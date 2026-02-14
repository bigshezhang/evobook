# Quiz 提交防重测试验证

## 测试目标

验证 Quiz 提交机制的修复，确保不会产生重复提交记录。

## 修复内容总结

### 前端改动 (QuizView.tsx)

1. **添加 `submitting` 状态标志**：防止快速点击产生多次提交
2. **提交时机调整**：将 `submitQuizAttempt()` 从 `RewardModal.onClose` 移到"Submit Answers"按钮的第一次点击
3. **按钮状态优化**：提交时显示加载状态和禁用按钮

### 后端改动 (quiz.py)

1. **增强防重逻辑**：检测到 `attempt_id` 已经提交过（score 不为 None）时，直接返回而不创建新记录
2. **添加日志记录**：记录防重逻辑被触发的情况

## 测试步骤

### 测试 1: 正常提交流程

**目的**：验证正常提交流程是否工作正常

**步骤**：
1. 启动前端和后端服务
2. 登录并进入一个课程
3. 完成一些学习内容
4. 进入 Quiz 页面
5. 回答所有问题
6. 点击"Submit Answers"按钮
7. 观察按钮变为"Submitting..."状态
8. 等待提交完成，按钮变为"View Results"
9. 点击"View Results"查看结果和奖励

**预期结果**：
- ✅ 按钮在提交时显示加载状态
- ✅ 提交成功后显示正确/错误答案
- ✅ 数据库中创建一条 quiz attempt 记录
- ✅ 奖励正常发放

### 测试 2: 防止快速重复点击

**目的**：验证前端防重机制是否有效

**步骤**：
1. 进入 Quiz 页面并回答问题
2. **快速连续多次点击**"Submit Answers"按钮（至少 5 次）
3. 查看网络请求（浏览器开发者工具 Network 标签）
4. 查看数据库中的 quiz_attempts 表

**预期结果**：
- ✅ 按钮第一次点击后立即变为禁用状态
- ✅ 网络请求只发送一次 `/api/v1/quiz/submit`
- ✅ 数据库中只有一条记录
- ✅ 控制台无错误信息

### 测试 3: 后端防重机制（模拟场景）

**目的**：验证后端防重逻辑是否有效

**步骤**：
1. 正常提交一次 Quiz（获得 `attempt_id`）
2. 使用相同的 `attempt_id` 再次调用 `/api/v1/quiz/submit` 接口（可用 curl 或 Postman）
   ```bash
   curl -X POST http://localhost:8000/api/v1/quiz/submit \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "course_map_id": "...",
       "node_id": 1,
       "attempt_id": "EXISTING_ATTEMPT_ID",
       "quiz_json": {...},
       "score": 80
     }'
   ```
3. 检查后端日志
4. 检查数据库中的记录数

**预期结果**：
- ✅ 后端返回 201 Created 和原有的 `attempt_id`
- ✅ 后端日志显示 "Duplicate quiz submission blocked"
- ✅ 数据库中仍然只有一条记录（未创建新记录）

### 测试 4: Quiz History 验证

**目的**：验证 Quiz History 页面显示正确

**步骤**：
1. 完成上述测试后
2. 进入 Quiz History 页面
3. 查看历史记录数量

**预期结果**：
- ✅ 只显示一条提交记录
- ✅ 分数、时间等信息正确显示

## 数据库验证查询

连接到数据库并执行以下查询：

```sql
-- 查看特定用户的某个节点的所有 quiz attempts
SELECT 
    id, 
    user_id, 
    course_map_id, 
    node_id, 
    score, 
    created_at
FROM quiz_attempts
WHERE user_id = 'YOUR_USER_ID'
  AND course_map_id = 'YOUR_COURSE_MAP_ID'
  AND node_id = YOUR_NODE_ID
ORDER BY created_at DESC;

-- 检查是否有重复的 draft 或提交记录
SELECT 
    course_map_id, 
    node_id, 
    user_id, 
    COUNT(*) as attempt_count,
    COUNT(CASE WHEN score IS NOT NULL THEN 1 END) as submitted_count
FROM quiz_attempts
WHERE user_id = 'YOUR_USER_ID'
GROUP BY course_map_id, node_id, user_id
HAVING COUNT(*) > 1;
```

## 后端日志示例

### 正常提交
```
INFO: Quiz draft updated with submission attempt_id=... score=80
```

### 防重拦截
```
WARNING: Duplicate quiz submission blocked attempt_id=... user_id=... existing_score=80
```

## 回归测试清单

确保修复不影响现有功能：

- [ ] Draft 保存功能正常（答题过程中自动保存）
- [ ] Draft 恢复功能正常（刷新页面后恢复答题状态）
- [ ] Quiz 生成功能正常
- [ ] 经验值和金币奖励正常发放
- [ ] 节点进度更新正常（首次完成时标记为 completed）
- [ ] 多次做同一个 quiz 都能正常记录（不同的 attempt）

## 已知边界情况

1. **网络中断场景**：如果提交时网络中断，用户可以再次点击提交
   - 前端会重试提交
   - 后端会识别为 draft 更新（如果是第一次失败）或防重拦截（如果已经提交成功）

2. **并发提交**：虽然前端有防重，但理论上仍可能通过不同的方式（如浏览器控制台）触发并发请求
   - 后端的防重逻辑会捕获这种情况
   - 数据库事务确保只创建一条记录

## 测试完成标准

所有以下条件都满足：

- ✅ 测试 1-4 全部通过
- ✅ 数据库查询确认无重复记录
- ✅ 后端日志显示防重逻辑正常工作
- ✅ 回归测试清单全部通过
- ✅ 无新增的 linter 错误或警告
