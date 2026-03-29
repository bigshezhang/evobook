# 维度二：后端轻量性 — 评分 A

> Hono + Drizzle + tRPC 是目前最轻量的全栈 Node 组合之一

---

## 为什么给 A

当前技术选型在 Node.js 生态中几乎是**最轻量的可行方案**：

| 层级 | 选型 | 替代方案 | 对比 |
|------|------|---------|------|
| HTTP 框架 | **Hono** | Express / Fastify / NestJS | Hono 零依赖、启动 < 10ms、内存占用最低 |
| RPC 层 | **tRPC** | REST + OpenAPI / GraphQL | tRPC 零运行时开销（只有 Zod 校验），无 schema 解析 |
| ORM | **Drizzle** | Prisma / TypeORM / Sequelize | Drizzle 生成接近原生 SQL，无 runtime engine |
| 校验 | **Zod** | Joi / Yup / class-validator | Zod 与 tRPC 原生集成，零额外开销 |
| 数据库驱动 | **postgres** (porsager) | pg / knex | 纯 JS、无 native bindings |

**启动链路**：`Hono() → cors + logger → tRPC fetchHandler → serve()`。没有 DI 容器、没有装饰器反射、没有中间件链条冗余。

---

## 维持轻量性的注意事项

### 1. 警惕依赖膨胀

当前 `package.json` 已有一个死依赖：

```json
"@ai-sdk/openai": "^1.3.22"  // 代码中未使用
```

**行动**：移除未使用的依赖。定期运行 `npx depcheck` 检查。

### 2. LLM 调用使用原生 fetch（保持）

当前 `lib/llm.ts` 用 `fetch()` 直接调 Gemini API，不引入 SDK 中间层。这是一个**正确的轻量性选择**。

如果将来需要 Provider 抽象（见 dim-3-ai-native.md），应确保新的 provider 层也是纯函数 + fetch，不引入重 SDK。

### 3. 避免引入 NestJS 模式

随着项目增长，可能有引入以下"重量级"模式的冲动。以下场景评估是否值得：

| 模式 | 是否引入 | 理由 |
|------|---------|------|
| DI 容器（tsyringe / InversifyJS） | ❌ 不需要 | tRPC context + 函数参数传 db 已满足可测试性 |
| 装饰器元编程 | ❌ 不需要 | Zod + tRPC 的声明式 API 已足够 |
| 全局中间件链 | ❌ 不需要 | protectedProcedure middleware 是按需组合 |
| ORM 实体类 | ❌ 不需要 | Drizzle 的 schema-as-code 比实体类更轻 |
| 结构化日志框架（pino） | ✅ 值得 | console.log 在生产环境不够用，pino 够轻 |
| 进程监控（Prometheus metrics） | ✅ 值得 | 当用户量增长时必要 |

### 4. tRPC Batch 是天然的性能优化

tRPC 的 `httpBatchLink` 自动将同一渲染周期内的多个 query 合并为一个 HTTP 请求。当前移动端和 Web 端都配置了 batch link。这意味着：

- 一个页面加载 3 个 query → 只发 1 个 HTTP 请求
- 服务端只走 1 次 `createContext`（1 次 JWT 校验，而非 3 次）

**确保不破坏**：如果未来引入任何中间件，需确认它与 batch request 兼容。

### 5. 后台任务的轻量处理

`course-map/service.ts` 中内容预生成使用了 fire-and-forget 模式：

```typescript
generateAllNodeContents(db, courseMapId, learnNodes, courseInfo).catch((err) =>
  console.error(`[courseMap.pregenerate] Background generation failed: ${err}`),
);
```

这在当前单实例部署下是合理的——不需要引入 Bull / BullMQ 等任务队列。

**触发点**（何时需要队列）：
- 多实例部署且需要避免重复生成
- 需要任务重试、优先级、延迟执行
- 后台任务失败需要可靠的通知机制

---

## 性能基线建议

当前没有性能监控。建议建立以下基线：

### 最小监控（推荐立即做）

在 `lib/llm.ts` 已有的 `prompt_runs` 表基础上，增加 API 层面的延迟追踪：

```typescript
// 在 tRPC 层添加 middleware 记录延迟
const withTiming = middleware(async ({ path, type, next }) => {
  const start = performance.now();
  const result = await next();
  const ms = Math.round(performance.now() - start);
  if (ms > 1000) {
    console.warn(`[slow] ${type} ${path} took ${ms}ms`);
  }
  return result;
});
```

### 进阶监控（用户量增长后）

- Prometheus 指标：请求延迟直方图、错误率、LLM 调用次数/延迟
- `node_contents` 生成队列深度
- 数据库查询耗时（Drizzle logger）

---

## 潜在的轻量性风险

### `listCourseMaps` 的 N+1 查询

```typescript
// course-map/service.ts L356-376
for (const row of rows) {
  // 对每个课程都查一次 node_progress count
  const progressRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(nodeProgress)
    .where(and(
      eq(nodeProgress.userId, userId),
      eq(nodeProgress.courseMapId, row.id),
      eq(nodeProgress.status, 'completed'),
    ));
  completedNodes = progressRows[0]?.count ?? 0;
}
```

用户有 10 个课程 → 10 次额外 DB 查询。

**改进**：用一次聚合查询替代：

```typescript
const progressCounts = await db
  .select({
    courseMapId: nodeProgress.courseMapId,
    count: sql<number>`count(*)::int`,
  })
  .from(nodeProgress)
  .where(and(
    eq(nodeProgress.userId, userId),
    eq(nodeProgress.status, 'completed'),
  ))
  .groupBy(nodeProgress.courseMapId);
```

### `joinCourse` 的逐条插入

```typescript
// discovery/service.ts L156-169
for (const nc of sourceContents) {
  await db.insert(nodeContents).values({ ... });
}
// L183-192
for (const node of nodes) {
  await db.insert(nodeProgress).values({ ... });
}
```

节点多时会有大量单条 INSERT。

**改进**：批量插入：

```typescript
await db.insert(nodeContents).values(
  sourceContents.map(nc => ({ courseMapId: newCourseMapId, nodeId: nc.nodeId, ... }))
);
```

---

## 总结

后端轻量性是这个项目的最大优势之一。维护要点：

1. **不引入重框架**——抵制 NestJS/TypeORM 的诱惑
2. **定期清理死依赖**——`depcheck`
3. **修复 N+1 查询**——listCourseMaps 和 joinCourse
4. **建立延迟基线**——至少一个 slow query logger
5. **后台任务保持 fire-and-forget**——直到需要多实例才引入队列
