# 维度一：后端架构 — 评分 B+

> Feature-sliced 结构清晰，tRPC 选型正确，但缺少 Repository 层且错误处理不一致

---

## 当前架构概述

```
Hono (HTTP) → tRPC (RPC/类型安全) → Feature Slices → Drizzle ORM → PostgreSQL
                                        ↕
                                    lib/ (LLM, Prompts, Auth)
```

**技术选型**：Hono + tRPC + Drizzle + Zod + Supabase Auth（jose JWKS 校验）

**切片结构**：13 个 feature（health, profile, discovery, onboarding, course-map, node-progress, node-content, quiz, learning-session, game, shop, inventory, invite），每个 `router.ts` + `service.ts`。

---

## 优势（维持不变的部分）

### 1. Vertical Slice Architecture 实现良好

- **零跨切片 import**：逐文件审查确认，没有 `features/A` 导入 `features/B` 的代码
- **切片自包含**：每个 feature 只依赖共享基础设施（`db/`, `lib/`, `trpc.ts`）
- **无强制抽象**：没有 BaseService、IRepository 等过度抽象
- **添加功能不影响现有代码**：新建一个 feature 目录即可

### 2. tRPC 类型链

从 `db/schema.ts` 定义类型 → `service.ts` 使用 → `router.ts` 暴露 → 客户端自动推断。**端到端类型安全**无需手写 API 类型定义。

### 3. 瘦 Router 模式

Router 只做三件事：Zod 输入校验、调用 service、错误映射。业务逻辑全在 service 层。

---

## 问题与改进

### 问题 1（P0）：错误处理 4 种模式并存

当前后端存在 4 种不同的错误传递方式：

| 模式 | 使用者 | 问题 |
|------|--------|------|
| Service 抛 `TRPCError` | game, shop, inventory, course-map(部分), node-content | Service 耦合传输层 |
| Service 抛 `Error` → Router `message.includes` 匹配 | discovery, onboarding | 极脆弱，改措辞即崩 |
| Service 返回 `{ success: false, error: '...' }` | invite.bindInviteCode | 不一致，调用方需记忆 |
| `catch {}` 静默吞掉 | trpc.ts 的 ensureProfile | 掩盖真实错误 |

**改进方案**：

新增 `src/lib/errors.ts`，统一使用 `AppError`：

```typescript
export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  PRECONDITION_FAILED = 'PRECONDITION_FAILED',
  INTERNAL = 'INTERNAL',
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(msg: string) { return new AppError(ErrorCode.NOT_FOUND, msg); }
  static badRequest(msg: string) { return new AppError(ErrorCode.BAD_REQUEST, msg); }
  static conflict(msg: string) { return new AppError(ErrorCode.CONFLICT, msg); }
}
```

Router 层统一映射：

```typescript
// src/lib/trpc-error-mapper.ts
export function mapAppError(err: unknown): TRPCError {
  if (err instanceof AppError) {
    return new TRPCError({ code: CODE_MAP[err.code], message: err.message, cause: err });
  }
  if (err instanceof TRPCError) return err;
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: err instanceof Error ? err.message : 'Unknown error',
  });
}
```

**迁移优先级**：先改 discovery + onboarding（message 匹配最脆弱），再改 game/shop/inventory（TRPCError in service），最后统一其余。

---

### 问题 2（P1）：profiles 表成为 "上帝表"

`profiles` 被 **8 个切片** 读写，包含了用户身份、经济系统、装扮、学习状态等完全不同的关注点：

| 字段群 | 关注点 | 读写切片 |
|--------|--------|----------|
| id, email, displayName, avatarUrl | 身份 | profile |
| goldBalance, diceRollsCount, level, currentExp | 经济 | game, shop |
| currentOutfit | 装扮 | inventory |
| activeCourseMapId | 学习状态 | course-map, discovery |
| lastAccessedCourseMapId, lastAccessedNodeId | 会话追踪 | learning-session |
| onboardingCompleted | 引导状态 | onboarding |

**短期**（标注声明）：每个 service 文件头部注释声明自己操作的表和字段：

```typescript
// features/game/service.ts
// 操作表：profiles（goldBalance, diceRollsCount, level, currentExp）
//        gameTransactions（写入）, shopItems（读取）, userInventory（读取）
```

**中期**（推荐，表拆分）：将 profiles 中的领域字段拆为独立表——`user_economy`（game 拥有）、`user_appearance`（inventory 拥有）、`user_learning_state`（course-map 拥有）。每个切片只读写自己的表。

---

### 问题 3（P1）：巨型 Schema 单文件

`db/schema.ts` 包含 16 张表、9 个 enum、13 个 relations，约 500+ 行。

**改进方案**：按领域分组为多文件，保持 barrel export 兼容：

```
src/db/schema/
  index.ts          # re-export all（外部 import 路径不变）
  enums.ts          # 所有 pgEnum
  types.ts          # MapMetaJson, DAGNodeJson 等 JSON 类型
  learning.ts       # courseMaps, nodeContents, nodeProgress
  user.ts           # profiles, userStats, learningActivities
  game.ts           # gameTransactions, shopItems, userInventory
  ...               # 按领域继续
  relations.ts      # 所有 relations（跨表引用不可避免，集中定义）
```

---

### 问题 4（P2）：复杂切片缺少内部拆分

`course-map/service.ts`（533 行）和 `onboarding/service.ts`（448 行）各自包含了 LLM 编排、后台任务、数据查询等多种职责。

**改进方案**：

```
features/course-map/
  router.ts
  service.ts           # 对外接口 + 编排
  generate-dag.ts      # callLLMGenerateCourseMap
  pregenerate.ts       # 后台内容预生成
  queries.ts           # listCourseMaps, getCourseMapDetail, getGenerationProgress
```

拆分只在切片内部发生，外部仍只 import `service.ts`。

---

### 问题 5（P2）：createContext 每请求查 DB

```typescript
// trpc.ts — 每个请求都执行
await ensureProfileExists(userId, email);
await ensureUserStatsExists(userId);
```

即使是公开接口（只要请求带了 token），也会执行这两次 DB 操作。

**改进方案**：将 ensure 逻辑移到 `protectedProcedure` 中间件中，用进程级 `Set<string>` 缓存已处理的用户：

```typescript
const ensuredUsers = new Set<string>();
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!ensuredUsers.has(ctx.userId)) {
    await ensureProfileExists(ctx.userId, ctx.email);
    await ensureUserStatsExists(ctx.userId);
    ensuredUsers.add(ctx.userId);
  }
  return next({ ctx: { ...ctx, userId: ctx.userId as string } });
});
```

---

## 是否需要 Repository 层？

评分中提到"缺少 Repository 层"，但这**不一定是问题**。

**不需要 Repository 的理由**：
- Drizzle ORM 已经是足够薄的数据访问层
- VSA 不强制要求共享抽象
- 当前体量下，Service 直接操作 Drizzle 是最简单高效的方式

**需要 Repository 的触发点**（未来可能）：
- 需要为 Service 写单元测试，且想 mock 掉数据库
- 需要在多个切片间复用相同的复杂查询逻辑
- 引入缓存层（Redis）需要在 DB 和 Service 之间插入

**建议**：当前不引入 Repository，但当上述触发点出现时，优先对该切片局部引入，不做全局强制。

---

## 改进优先级总表

| 优先级 | 改动 | 预计工作量 |
|--------|------|-----------|
| P0 | 统一错误处理（AppError + mapAppError） | 1-2 天 |
| P1 | profiles 字段标注声明 | 2 小时 |
| P1 | Schema 按领域分组 | 半天 |
| P2 | 复杂切片内部拆分 | 1 天 |
| P2 | createContext DB 开销优化 | 2 小时 |
| P3 | profiles 表拆分（中期） | 2-3 天（含迁移） |
