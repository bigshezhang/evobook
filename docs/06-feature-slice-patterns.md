# Feature Slice 规范与模板

## 现状总结

当前 13 个 feature slice 遵循统一模式 `router.ts + service.ts`，整体一致性良好。但在复杂度管理、跨表访问、代码复用方面缺少明确规范。

---

## 规范 1: Slice 目录结构

### 简单 Slice（CRUD，< 200 行 service）

```
features/health/
  router.ts
```

```
features/inventory/
  router.ts
  service.ts
```

保持现状，不需要额外拆分。

### 中等 Slice（业务逻辑 + DB 操作，200-400 行）

```
features/quiz/
  router.ts
  service.ts
```

保持现状。当前的 quiz、profile、node-progress 等都在这个范围内。

### 复杂 Slice（LLM 编排 + 后台任务 + 多步骤，> 400 行）

当前 `course-map/service.ts` 有 533 行，`onboarding/service.ts` 有 448 行。建议拆分：

```
features/course-map/
  router.ts              # tRPC route 定义
  service.ts             # 对外的 service 接口（orchestrator）
  generate-dag.ts        # callLLMGenerateCourseMap 逻辑
  pregenerate.ts         # triggerContentPregeneration + generateAllNodeContents
  queries.ts             # listCourseMaps, getCourseMapDetail, getGenerationProgress
```

```
features/onboarding/
  router.ts
  service.ts             # processOnboardingNext（编排层）
  phase-handlers.ts      # 各阶段的 LLM 调用逻辑
  session-manager.ts     # session 的 CRUD 操作
```

**原则**：拆分只在 slice 内部发生，不影响 slice 边界。外部仍然只 import `service.ts` 导出的函数。

---

## 规范 2: Service 函数签名约定

### 当前模式（保持）

```typescript
export async function getProgress(
  db: Database,
  userId: string,
  courseMapId: string,
): Promise<NodeProgressItem[]>
```

**第一个参数是 `db: Database`**——这是正确的做法，保持 service 的可测试性和纯粹性。

### 建议补充的约定

1. **返回值永远是业务类型，不是 DB row**：

```typescript
// ✅ 好：返回业务接口
export async function getProfile(db: Database, userId: string): Promise<ProfileRow | null>

// ❌ 不好：直接返回 DB select 结果
export async function getProfile(db: Database, userId: string) {
  return db.select().from(profiles).where(eq(profiles.id, userId));
}
```

2. **不返回 HTTP 语义的对象**（如 `{ message: 'Course joined!' }`）：

```typescript
// ❌ 当前（discovery/service.ts）
return {
  courseMapId: newCourseMapId,
  message: 'Course joined! You can start learning now.',
};

// ✅ 建议
return { courseMapId: newCourseMapId };
// message 由 router 层或客户端决定
```

3. **错误只用 AppError**（见 [02-error-handling-reform.md](./02-error-handling-reform.md)）：

```typescript
// ✅ 好
throw AppError.notFound(`Course '${id}' not found`);

// ❌ 不好
throw new TRPCError({ code: 'NOT_FOUND', ... });  // service 不应依赖 tRPC
throw new Error('not found');  // 不结构化，需要字符串匹配
```

---

## 规范 3: 跨表访问的治理

### 现状

多个 slice 操作 `profiles` 表是最大的隐式耦合点：

- **discovery**: 写 `profiles.activeCourseMapId`
- **course-map**: 写 `profiles.activeCourseMapId`
- **game**: 读写 `profiles.goldBalance`, `diceRollsCount`, `level`, `currentExp`
- **inventory**: 写 `profiles.currentOutfit`
- **learning-session**: 写 `profiles.lastAccessedCourseMapId`, `lastAccessedNodeId`

### 建议策略

**短期（不破坏现状）**：在每个 service 文件头部明确注释声明自己操作的表：

```typescript
// features/game/service.ts
// 本切片操作的表：profiles（读写经济数据）、gameTransactions（写）、
//                shopItems（读）、userInventory（读）
```

**中期（推荐）**：将 `profiles` 表中各切片关心的字段分离为独立表：

| 当前 profiles 字段 | 建议归属表 | 归属切片 |
|---------------------|-----------|----------|
| id, email, displayName, avatarUrl, onboardingCompleted | profiles（保留） | profile |
| goldBalance, diceRollsCount, level, currentExp, travelBoardPosition | user_economy | game |
| currentOutfit | user_appearance | inventory |
| activeCourseMapId | user_learning_state | course-map |
| lastAccessedCourseMapId, lastAccessedNodeId | user_learning_state | learning-session |

这样每个切片只读写自己拥有的表，消除隐式耦合。但这需要较大的迁移成本，建议在有充足测试覆盖后执行。

**长期（理想）**：对于需要跨切片读取的数据（如 game 切片需要知道用户名），采用**只读视图**或**事件通知**模式：

```typescript
// 读其他切片的数据，通过明确的查询函数，而非直接操作表
import { getUserDisplayName } from '../profile/queries';
```

这引入了切片间依赖，但是**单向只读**依赖，比双向写入耦合好得多。

---

## 规范 4: 日志约定

当前各 feature 的日志风格基本一致，但有改进空间：

### 当前模式（良好）

```typescript
console.log(`[discovery.joinCourse] user=${userId}, presetId=${presetId}, newCourseMapId=${newCourseMapId}`);
```

### 建议统一为

```typescript
// 统一前缀格式：[模块.方法]
console.log(`[game.rollDice] userId=${userId}, result=${diceResult}, remaining=${newDiceCount}`);

// 错误日志
console.error(`[courseMap.pregenerate] Node ${node.id} failed: ${errorMsg}`);
```

**当前已基本遵循这个模式**，继续保持即可。唯一建议是未来考虑引入结构化日志（如 `pino`），以便在生产环境中做日志聚合和查询。

---

## 规范 5: 新 Feature Slice 模板

创建新 feature 时，复制以下模板：

### router.ts 模板

```typescript
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../../trpc';
import { mapAppError } from '../../lib/trpc-error-mapper';
import { myFunction } from './service';

export const myFeatureRouter = router({
  myQuery: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await myFunction(ctx.db, ctx.userId, input.id);
      } catch (err) {
        throw mapAppError(err);
      }
    }),
});
```

### service.ts 模板

```typescript
import type { Database } from '../../db';
import { AppError } from '../../lib/errors';
// import 本切片需要的 schema 表
// import { myTable } from '../../db/schema';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface MyResult {
  // 业务返回类型
}

// ─── 业务函数 ─────────────────────────────────────────────────────────────────

export async function myFunction(
  db: Database,
  userId: string,
  id: string,
): Promise<MyResult> {
  // 业务逻辑
  // 错误抛 AppError
  // 返回业务类型
}
```

---

## 规范 6: 当前各 Slice 改造清单

| Slice | 当前状态 | 需要改造 |
|-------|---------|---------|
| health | ✅ 完美 | 无 |
| profile | ✅ 良好 | 返回类型可更明确 |
| discovery | ⚠️ message 匹配错误 | 改用 AppError |
| onboarding | ⚠️ 大文件 + message 匹配 | 拆分 + 改用 AppError |
| course-map | ⚠️ 大文件 + 混合错误 | 拆分 + 统一错误处理 |
| node-progress | ✅ 良好 | 无 |
| node-content | ✅ 良好 | TRPCError → AppError |
| quiz | ✅ 良好 | 无显式错误处理需关注 |
| game | ⚠️ TRPCError in service | 改用 AppError |
| shop | ⚠️ TRPCError in service | 改用 AppError |
| inventory | ⚠️ TRPCError in service | 改用 AppError |
| invite | ⚠️ 混合模式 | 统一为 AppError |
| learning-session | ✅ 良好 | 无 |
