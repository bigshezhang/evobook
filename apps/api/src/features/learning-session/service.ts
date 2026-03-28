import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../db';
import { profiles, userStats } from '../../db/schema';

// ─── 常量 ──────────────────────────────────────────────────────────────────────

/** 心跳间隔秒数，前端每 30 秒发送一次 */
const HEARTBEAT_SECONDS = 30;

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

export interface HeartbeatResult {
  acknowledged: boolean;
  totalStudySeconds: number;
  reason?: string;
}

// ─── 学习心跳 ──────────────────────────────────────────────────────────────────

export async function handleHeartbeat(
  db: Database,
  userId: string,
  courseMapId: string,
  _nodeId: number,
  _clientTimestamp?: string,
): Promise<HeartbeatResult> {
  // 累加学习时长
  const [updatedStats] = await db
    .update(userStats)
    .set({
      totalStudySeconds: sql`${userStats.totalStudySeconds} + ${HEARTBEAT_SECONDS}`,
    })
    .where(eq(userStats.userId, userId))
    .returning({ totalStudySeconds: userStats.totalStudySeconds });

  if (!updatedStats) {
    console.error(`Heartbeat failed: user_stats not found for user=${userId}`);
    return {
      acknowledged: false,
      totalStudySeconds: 0,
      reason: 'user_stats record not found',
    };
  }

  // 更新最近访问的课程和时间
  await db
    .update(profiles)
    .set({
      lastAccessedCourseMapId: courseMapId,
      lastAccessedAt: new Date(),
    })
    .where(eq(profiles.id, userId));

  console.log(
    `Heartbeat: user=${userId} courseMap=${courseMapId} totalSeconds=${updatedStats.totalStudySeconds}`,
  );

  return {
    acknowledged: true,
    totalStudySeconds: updatedStats.totalStudySeconds,
  };
}
