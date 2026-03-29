# 错误处理策略改革

## 现状问题

当前后端存在 **4 种不一致的错误处理模式**，是最需要优先修复的架构问题。

### 模式 A：Service 直接抛 TRPCError

```typescript
// game/service.ts, shop/service.ts, inventory/service.ts
throw new TRPCError({ code: 'NOT_FOUND', message: 'User profile not found' });
```

**问题**：Service 层与传输层（tRPC）耦合。如果未来要复用 service（如 CLI 工具、定时任务），`TRPCError` 在非 tRPC 上下文中无意义。

### 模式 B：Service 抛 Error，Router 用 message 字符串匹配

```typescript
// discovery/service.ts
throw new Error(`Discovery course '${presetId}' not found`);

// discovery/router.ts
if (message.includes('not found')) {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}
```

**问题**：极度脆弱。改动 error message 措辞就会静默破坏错误映射。无法被类型系统捕获。

### 模式 C：Service 返回结果对象

```typescript
// invite/service.ts
return { success: false, error: 'already_bound' };

// invite/router.ts
if (result.error === 'already_bound') {
  throw new TRPCError({ code: 'CONFLICT', ... });
}
```

**问题**：模式本身合理，但与其他 feature 不一致。调用方需要记住哪些 service 用返回值、哪些用异常。

### 模式 D：静默吞掉错误

```typescript
// trpc.ts
try {
  await db.insert(profiles).values(...).onConflictDoNothing();
} catch {
  // 并发创建的竞态条件，忽略
}

// _layout.tsx (mobile)
} catch {}
```

**问题**：掩盖真实错误，无法排查问题。

---

## 改革方案：AppError + 错误码枚举

### 核心思想

1. **Service 层**：抛自定义 `AppError`（不依赖 tRPC）
2. **Router 层**：统一的 error boundary 将 `AppError` 映射为 `TRPCError`
3. **错误码**：用 TypeScript 枚举，不用魔法字符串

### Step 1: 定义 AppError

建议新增文件 `src/lib/errors.ts`：

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

  static notFound(message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorCode.NOT_FOUND, message, details);
  }

  static badRequest(message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorCode.BAD_REQUEST, message, details);
  }

  static conflict(message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorCode.CONFLICT, message, details);
  }

  static preconditionFailed(message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorCode.PRECONDITION_FAILED, message, details);
  }
}
```

### Step 2: 统一 Router 层错误映射

在 `trpc.ts` 中添加 error formatter 或在每个 router 中使用统一的包装：

```typescript
// src/lib/trpc-error-mapper.ts
import { TRPCError } from '@trpc/server';
import { AppError, ErrorCode } from './errors';

const CODE_MAP: Record<ErrorCode, TRPCError['code']> = {
  [ErrorCode.NOT_FOUND]: 'NOT_FOUND',
  [ErrorCode.BAD_REQUEST]: 'BAD_REQUEST',
  [ErrorCode.CONFLICT]: 'CONFLICT',
  [ErrorCode.UNAUTHORIZED]: 'UNAUTHORIZED',
  [ErrorCode.PRECONDITION_FAILED]: 'PRECONDITION_FAILED',
  [ErrorCode.INTERNAL]: 'INTERNAL_SERVER_ERROR',
};

export function mapAppError(err: unknown): TRPCError {
  if (err instanceof AppError) {
    return new TRPCError({
      code: CODE_MAP[err.code],
      message: err.message,
      cause: err,
    });
  }
  if (err instanceof TRPCError) {
    return err;
  }
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: err instanceof Error ? err.message : 'Unknown error',
    cause: err,
  });
}
```

### Step 3: Service 层改造示例

**改造前**（discovery/service.ts）：
```typescript
throw new Error(`Discovery course '${presetId}' not found`);
```

**改造后**：
```typescript
throw AppError.notFound(`Discovery course '${presetId}' not found`);
```

**改造前**（game/service.ts）：
```typescript
throw new TRPCError({ code: 'NOT_FOUND', message: 'User profile not found' });
```

**改造后**：
```typescript
throw AppError.notFound('User profile not found');
```

### Step 4: Router 层改造示例

**改造前**（discovery/router.ts）：
```typescript
try {
  const result = await joinCourse(ctx.db, ctx.userId, input.presetId);
  return result;
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  if (message.includes('not found')) {
    throw new TRPCError({ code: 'NOT_FOUND', message });
  }
  if (message.includes('no pre-built content')) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message });
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
}
```

**改造后**：
```typescript
try {
  return await joinCourse(ctx.db, ctx.userId, input.presetId);
} catch (err) {
  throw mapAppError(err);
}
```

或者更进一步，用 tRPC middleware 统一处理，不需要在每个 router 里 try/catch。

---

## 迁移策略

### 优先级排序

| 优先级 | 文件 | 当前模式 | 改造复杂度 |
|--------|------|----------|-----------|
| P0 | discovery/service.ts + router.ts | Error + message 匹配 | 低 |
| P0 | onboarding/service.ts + router.ts | Error + message 匹配 | 低 |
| P1 | game/service.ts | TRPCError 直接在 service | 中（需移除 TRPCError 依赖） |
| P1 | shop/service.ts | TRPCError 直接在 service | 低 |
| P1 | inventory/service.ts | TRPCError 直接在 service | 低 |
| P1 | course-map/service.ts | 混合（部分 TRPCError） | 中 |
| P2 | node-content/service.ts | TRPCError | 低 |
| P2 | invite/service.ts + router.ts | 结果对象 + Error | 低 |

### 分阶段执行

1. **Phase 1**：创建 `AppError` + `mapAppError`，不改动现有代码
2. **Phase 2**：改造 P0 的 message 匹配模式（最脆弱的）
3. **Phase 3**：改造 P1 的 TRPCError-in-service 模式
4. **Phase 4**：改造 P2 的剩余 feature

每个 Phase 可独立 PR，逐步推进不影响线上。
