# 维度四：AI Coding 友好度 — 评分 A

> 扁平结构、一致 pattern、完整类型链，非常适合 AI 辅助开发

---

## 为什么给 A

这个后端的代码结构对 AI 编码助手（Cursor、Copilot、Claude 等）**极其友好**。AI 能快速理解上下文、生成正确代码的关键因素，本项目几乎全部满足。

---

## AI Coding 友好的 6 个维度

### 1. ✅ 扁平且可预测的文件结构

```
src/features/{name}/router.ts   ← AI 看到名字就知道这是路由
src/features/{name}/service.ts  ← AI 看到名字就知道这是业务逻辑
src/db/schema.ts               ← AI 看到名字就知道这是数据库表
src/lib/llm.ts                 ← AI 看到名字就知道这是 LLM 调用
```

**为什么重要**：AI 的上下文窗口有限。当文件路径本身就传达了语义，AI 不需要额外探索就能定位代码。

**对比**：如果采用 NestJS 风格（`@Module`, `@Injectable`, 多文件装饰器），AI 需要读 5-6 个文件才能理解一个 feature。当前项目只需读 2 个文件（router + service）。

### 2. ✅ 一致的 Pattern

所有 feature 遵循同一模板：

```typescript
// router.ts 模板
export const xxxRouter = router({
  myMethod: protectedProcedure
    .input(z.object({ ... }))
    .query/mutation(async ({ ctx, input }) => {
      return await myService(ctx.db, ctx.userId, input.xxx);
    }),
});

// service.ts 模板
export async function myService(
  db: Database,
  userId: string,
  xxx: string,
): Promise<MyResult> {
  // Drizzle query
}
```

**为什么重要**：AI 看到 1-2 个 feature 的代码，就能准确推断所有 feature 的模式。生成新 feature 时，错误率极低。

### 3. ✅ 完整的端到端类型链

```
schema.ts 定义表类型
    ↓
service.ts 使用 Drizzle 查询（自动推断列类型）
    ↓
router.ts 通过 tRPC 暴露（自动推断返回类型）
    ↓
客户端 trpc.xxx.useQuery() 自动获得正确类型
```

**为什么重要**：AI 可以通过类型链推断出正确的字段名、参数类型、返回类型。减少"猜测"导致的错误。

### 4. ✅ 无隐式行为

- 没有 DI 容器的自动注入（显式传 `db` 参数）
- 没有装饰器的元编程魔法
- 没有 ORM 的隐式 lazy loading
- 没有全局状态突变

**为什么重要**：AI 不擅长理解隐式行为。当所有依赖都是显式的（函数参数），AI 能准确追踪数据流。

### 5. ✅ Zod Schema 即文档

```typescript
.input(z.object({
  courseMapId: z.string().uuid(),
  nodeId: z.number().int(),
  status: nodeStatusEnum,
}))
```

Zod schema 既是运行时校验，又是类型定义，又是接口文档。AI 可以直接从 schema 推断出 API 的输入输出格式。

### 6. ✅ 单一入口

`root-router.ts` 列出了所有 feature：

```typescript
export const appRouter = router({
  health: healthRouter,
  profile: profileRouter,
  discovery: discoveryRouter,
  // ...
});
```

AI 只需读这一个文件就能了解整个 API 的能力边界。

---

## 需要维护的注意事项

### 注意 1：不要引入 "AI 不友好" 的模式

以下模式会显著降低 AI Coding 效率：

| 模式 | AI 不友好的原因 | 建议 |
|------|----------------|------|
| DI 容器 | AI 无法追踪隐式注入的依赖 | 保持显式参数传递 |
| 装饰器 | 元编程改变运行时行为，AI 难以推断 | 不使用 |
| 动态 import | 打断静态分析链 | 保持静态 import |
| 继承层级 > 2 | AI 需要追踪多层覆写 | 优先组合 |
| 魔法字符串映射 | 如当前 `message.includes('not found')` | 改用枚举/类型 |
| Proxy / Reflect | 完全不可预测 | 不使用 |

### 注意 2：保持 "一个文件 = 一个关注点"

当前做得好的例子：
- `db/schema.ts` = 所有表定义
- `lib/llm.ts` = 所有 LLM 调用
- `lib/supabase.ts` = JWT 校验

需要注意的：`course-map/service.ts`（533 行）已开始混合多个关注点。当单文件超过 300 行时，AI 的上下文理解开始下降。

**建议**：超过 300 行的 service 做切片内拆分（见 dim-1-backend-architecture.md）。

### 注意 3：保持命名一致性

当前命名几乎完全一致：

```
features/course-map/  → courseMapRouter → courseMapService 的各函数
features/node-progress/ → nodeProgressRouter → getProgress/upsertProgress
```

**唯一不一致**：`features/quiz/router.ts` 导出 `quizRouter`，但 service 函数名有 `saveDraft`、`getDraft` 等未加 quiz 前缀。

这不是大问题，但如果能保持 `quiz.saveDraft` / `quiz.getDraft` 的命名空间一致性，对 AI 的自动补全更有帮助。

### 注意 4：为 AI 编写好的 JSDoc

当前大部分函数没有 JSDoc。虽然 TypeScript 类型本身提供了很多信息，但在以下场景 JSDoc 对 AI 特别有价值：

```typescript
/**
 * 后台逐个生成所有 learn 节点的知识卡片。
 * 失败的节点标记为 failed，不影响其他节点。
 *
 * 注意：此函数通常被 fire-and-forget 调用，不应阻塞主流程。
 */
async function generateAllNodeContents(...)
```

**关键 JSDoc 场景**：
- 函数有非显而易见的副作用
- 参数有隐含约束（如 "必须在 X 之后调用"）
- 返回值有特殊语义（如 `null` 代表 "未找到" 而非 "出错"）

### 注意 5：cursor rules 文件维护

项目已有 `.cursor/rules/dev-workflow.mdc`。建议在其中补充：

- 新增 feature 的代码模板
- 错误处理约定（统一为 AppError 后）
- 命名约定（router/service 函数命名规则）

这相当于给 AI 一份"项目编码规范"，每次对话都会自动加载。

---

## 可量化的 AI Coding 友好度指标

| 指标 | 当前值 | 说明 |
|------|--------|------|
| 新增一个 CRUD feature 需读的文件数 | **2-3 个** | 读一个现有 feature + schema |
| 理解一个 feature 需读的文件数 | **2 个** | router.ts + service.ts |
| 找到某个 API 入口需要的步骤 | **1 步** | 看 root-router.ts |
| 类型推断链断裂处 | **0 处**（后端内部） | tRPC + Drizzle 全链推断 |
| 隐式行为 / 元编程使用处 | **0 处** | 所有依赖显式传递 |
| 平均 service 文件行数 | **~200 行** | 合理范围（2 个超标） |

---

## 总结

AI Coding 友好度是这个项目的核心竞争力之一。**维护要点是避免引入 AI 不友好的模式**，而不是做大改动。唯一需要行动的是：

1. 拆分超长 service 文件
2. 消除 message.includes 等魔法字符串
3. 补充 cursor rules 中的编码规范
