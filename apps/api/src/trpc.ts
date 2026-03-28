import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { profiles, userStats } from './db/schema';
import { verifySupabaseToken } from './lib/supabase';

// ─── Context ─────────────────────────────────────────────────────────────────

export interface Context {
  userId: string | null;
  email: string | null;
  db: typeof db;
}

/**
 * 从请求 header 中提取 JWT，验证后返回 context。
 * 同时自动确保 profile 和 user_stats 行存在（首次登录自动创建）。
 */
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

  // 自动创建 profile（首次登录）
  await ensureProfileExists(userId, email);
  await ensureUserStatsExists(userId);

  return { userId, email, db };
}

async function ensureProfileExists(
  userId: string,
  email: string | null,
): Promise<void> {
  const existing = await db
    .select({ id: profiles.id, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (existing.length > 0) {
    if (email && existing[0].email !== email) {
      await db
        .update(profiles)
        .set({ email })
        .where(eq(profiles.id, userId));
    }
    return;
  }

  try {
    await db.insert(profiles).values({ id: userId, email }).onConflictDoNothing();
  } catch {
    // 并发创建的竞态条件，忽略
  }
}

async function ensureUserStatsExists(userId: string): Promise<void> {
  try {
    await db
      .insert(userStats)
      .values({ userId, totalStudySeconds: 0, completedCoursesCount: 0, masteredNodesCount: 0 })
      .onConflictDoNothing();
  } catch {
    // 忽略并发竞态
  }
}

// ─── tRPC 初始化 ─────────────────────────────────────────────────────────────

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const middleware = t.middleware;

// 公开过程（不需要登录）
export const publicProcedure = t.procedure;

// 需要登录的过程
const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId as string } });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// 可选登录的过程（userId 可能为 null）
export const optionalAuthProcedure = t.procedure;
