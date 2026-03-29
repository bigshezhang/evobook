# tRPC Context 与认证优化

## 现状分析

`src/trpc.ts` 是所有请求的入口，负责认证和上下文构建。

### 当前流程

```
每个请求 → createContext()
  ├── 解析 Authorization header
  ├── verifySupabaseToken(jwt)        ← 1次 JWKS 远程校验
  ├── ensureProfileExists(userId)     ← 1次 SELECT + 可能1次 INSERT
  ├── ensureUserStatsExists(userId)   ← 1次 INSERT (onConflictDoNothing)
  └── 返回 { userId, email, db }
```

---

## 问题 1: 每个请求都执行 DB 操作

即使是 `publicProcedure`（如 health check、discovery 列表），只要请求带了 `Authorization` header，就会执行 `ensureProfileExists` + `ensureUserStatsExists`。

**实际开销**：
- `ensureProfileExists`：`SELECT` 一次（必定执行），如果 email 变了还会 `UPDATE`
- `ensureUserStatsExists`：每次都执行 `INSERT ... ON CONFLICT DO NOTHING`

**场景**：一个已登录用户刷列表页，每次请求都在做这两个查询。这在 tRPC batch request（多个 procedure 打包成一个 HTTP 请求）下更是每批次都执行。

### 建议方案 A（推荐）：懒加载 + 缓存

```typescript
export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<Context> {
  const authHeader = opts.req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null, email: null, db };
  }

  const token = authHeader.slice(7);
  const payload = await verifySupabaseToken(token);
  if (!payload) {
    return { userId: null, email: null, db };
  }

  const userId = payload.sub;
  const email = payload.email ?? null;

  // 不在这里做 ensureProfile，推迟到 protectedProcedure 中
  return { userId, email, db };
}
```

将 `ensureProfileExists` 移到 `protectedProcedure` 中间件里，且**只在首次调用时执行**：

```typescript
const profileEnsuredUsers = new Set<string>();

const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  // 进程级缓存：每个用户在本进程生命周期内只确保一次
  if (!profileEnsuredUsers.has(ctx.userId)) {
    await ensureProfileExists(ctx.userId, ctx.email);
    await ensureUserStatsExists(ctx.userId);
    profileEnsuredUsers.add(ctx.userId);
  }

  return next({ ctx: { ...ctx, userId: ctx.userId as string } });
});
```

**注意**：进程级 `Set` 在单实例部署下有效。如果多实例部署，`INSERT ... ON CONFLICT DO NOTHING` 本身就是幂等的，偶尔重复执行无害。

### 建议方案 B（最小改动）：条件执行

```typescript
// 只在 token 首次出现时执行，后续跳过
// 简单方案：检查 profile 是否存在，存在则跳过整个 ensure 流程
const existing = await db
  .select({ id: profiles.id })
  .from(profiles)
  .where(eq(profiles.id, userId))
  .limit(1);

if (existing.length === 0) {
  await ensureProfileExists(userId, email);
  await ensureUserStatsExists(userId);
}
```

这仍然每次请求查一次 DB，但避免了大部分写操作。

---

## 问题 2: JWT 校验缓存

`verifySupabaseToken` 每次请求都去做完整的 JWT 校验（包括从 Supabase JWKS 端点获取公钥）。

### 建议

`jose` 库的 `createRemoteJWKSet` 内部有 key 缓存（默认 10 分钟），但 JWT 签名验证本身仍然每次执行。对于高频场景，可以考虑：

1. **短期 token 缓存**：对已验证的 token 做 LRU 缓存（按 token hash → payload），TTL 设为 30 秒
2. **这对 tRPC batch 特别有效**：一个 HTTP 请求中多个 procedure 共享同一个 context，不需要重复验证

```typescript
import { LRUCache } from 'lru-cache';

const tokenCache = new LRUCache<string, JWTPayload>({
  max: 1000,
  ttl: 30_000, // 30秒
});

export async function verifySupabaseToken(token: string): Promise<JWTPayload | null> {
  const hash = createHash('sha256').update(token).digest('hex').slice(0, 16);
  const cached = tokenCache.get(hash);
  if (cached) return cached;

  // 原有验证逻辑...
  const payload = await doVerify(token);
  if (payload) tokenCache.set(hash, payload);
  return payload;
}
```

**注意**：tRPC 的 batch request 是一个 HTTP 请求对应一次 `createContext` 调用，不会重复验证 JWT。所以 JWT 缓存主要优化的是同一用户的连续请求。

---

## 问题 3: Context 中传递 db 实例

```typescript
export interface Context {
  userId: string | null;
  email: string | null;
  db: typeof db;
}
```

`db` 是模块级单例，放在 context 中传递看起来是为了便于测试（可以注入不同的 db 实例）。这个设计本身是合理的。

但当前 **service 函数的第一个参数也是 `db`**：

```typescript
export async function getProgress(db: Database, userId: string, courseMapId: string)
```

这意味着 `db` 被传了两层（context → router → service）。

### 建议

这个模式在当前体量下没有实际问题。但如果需要简化，可以：

**方案 A**（保持现状）：继续传递 `db` 参数，保持 service 的可测试性。这是一个好习惯。

**方案 B**（简化）：service 直接导入 `db`，省去参数传递。但会牺牲测试时 mock db 的能力。

**推荐保持方案 A**——这是一个正确的设计选择，虽然略显冗余但利大于弊。

---

## 问题 4: optionalAuthProcedure 实际等于 publicProcedure

```typescript
// trpc.ts L103
export const optionalAuthProcedure = t.procedure;
```

`optionalAuthProcedure` 直接等于 `t.procedure`，与 `publicProcedure` 没有任何区别。语义上是想表达"用户可能登录也可能没登录"，但类型上 `ctx.userId` 仍然是 `string | null`，与 `publicProcedure` 完全一致。

### 建议

如果语义区分有价值（代码可读性），保留即可。但如果想让类型更精确：

```typescript
// 对于必须处理两种情况的 procedure，可以在 router 层显式处理
// 这不需要改动，只是明确文档化即可
```

实际上当前用法只有 `onboarding.next` 使用了 `optionalAuthProcedure`，保持现状即可。

---

## 优先级

| 优先级 | 改动 | 影响 | 工作量 |
|--------|------|------|--------|
| P0 | 将 ensureProfile 移到 protectedProcedure | 减少公开接口的 DB 开销 | 小 |
| P1 | 进程级用户缓存 | 减少已登录用户的重复查询 | 小 |
| P2 | JWT token 短期缓存 | 高频场景优化 | 中 |
| P3 | 文档化 optionalAuthProcedure 语义 | 代码清晰度 | 极小 |
