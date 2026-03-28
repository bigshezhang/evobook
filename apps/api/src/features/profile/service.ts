import { eq, and, desc, sql, gte, gt } from 'drizzle-orm';
import type { Database } from '../../db';
import {
  profiles,
  courseMaps,
  learningActivities,
  userStats,
  inviteBindings,
  userInvites,
} from '../../db/schema';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  email: string | null;
  displayName: string | null;
  mascot: string | null;
  onboardingCompleted: boolean;
  guidesCompleted: string[];
  goldBalance: number;
  diceRollsCount: number;
  level: number;
  currentExp: number;
  currentOutfit: string;
  travelBoardPosition: number;
  activeCourseMapId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileUpdateInput {
  displayName?: string;
  mascot?: string;
  onboardingCompleted?: boolean;
  guidesCompleted?: string[];
}

export interface LearningActivityItem {
  id: string;
  courseMapId: string;
  nodeId: number;
  activityType: string;
  completedAt: string;
  extraData: unknown;
}

export interface ProfileStatsResult {
  userName: string;
  joinedDate: string;
  totalStudyHours: number;
  totalStudySeconds: number;
  completedCoursesCount: number;
  masteredNodesCount: number;
  globalRank: number | null;
  rankPercentile: number | null;
  totalUsers: number;
  inviteCode: string | null;
  successfulInvitesCount: number;
}

// ─── 获取用户 Profile ─────────────────────────────────────────────────────────

export async function getProfile(
  db: Database,
  userId: string,
): Promise<ProfileRow | null> {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0] as ProfileRow;
}

// ─── 更新用户 Profile ─────────────────────────────────────────────────────────

export async function updateProfile(
  db: Database,
  userId: string,
  updates: ProfileUpdateInput,
): Promise<ProfileRow | null> {
  const setClause: Record<string, unknown> = {};

  if (updates.displayName !== undefined) setClause.displayName = updates.displayName;
  if (updates.mascot !== undefined) setClause.mascot = updates.mascot;
  if (updates.onboardingCompleted !== undefined) setClause.onboardingCompleted = updates.onboardingCompleted;
  if (updates.guidesCompleted !== undefined) setClause.guidesCompleted = updates.guidesCompleted;

  if (Object.keys(setClause).length === 0) {
    return getProfile(db, userId);
  }

  await db
    .update(profiles)
    .set(setClause)
    .where(eq(profiles.id, userId));

  return getProfile(db, userId);
}

// ─── 获取 Active Course Map ID ───────────────────────────────────────────────
// 优先级：active_course_map_id > last_accessed_course_map_id > 最新创建的 course map

export async function getActiveCourseMapId(
  db: Database,
  userId: string,
): Promise<string | null> {
  const profile = await getProfile(db, userId);
  if (!profile) return null;

  // 优先级 1：用户手动设置的 active course
  if (profile.activeCourseMapId) {
    return profile.activeCourseMapId;
  }

  // 优先级 2：最近访问的 course
  const row = await db
    .select({ lastAccessedCourseMapId: profiles.lastAccessedCourseMapId })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (row.length > 0 && row[0].lastAccessedCourseMapId) {
    return row[0].lastAccessedCourseMapId;
  }

  // 优先级 3：最新创建的 course map
  const latestCourse = await db
    .select({ id: courseMaps.id })
    .from(courseMaps)
    .where(eq(courseMaps.userId, userId))
    .orderBy(desc(courseMaps.createdAt))
    .limit(1);

  return latestCourse.length > 0 ? latestCourse[0].id : null;
}

// ─── 设置 Active Course Map ──────────────────────────────────────────────────

export async function setActiveCourseMap(
  db: Database,
  userId: string,
  courseMapId: string,
): Promise<void> {
  await db
    .update(profiles)
    .set({ activeCourseMapId: courseMapId })
    .where(eq(profiles.id, userId));
}

// ─── 获取学习活动 ─────────────────────────────────────────────────────────────

export async function getLearningActivities(
  db: Database,
  userId: string,
  days: number,
): Promise<{ activities: LearningActivityItem[]; total: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const rows = await db
    .select()
    .from(learningActivities)
    .where(
      and(
        eq(learningActivities.userId, userId),
        gte(learningActivities.completedAt, cutoff),
      ),
    )
    .orderBy(desc(learningActivities.completedAt));

  const activities: LearningActivityItem[] = rows.map((r) => ({
    id: r.id,
    courseMapId: r.courseMapId,
    nodeId: r.nodeId,
    activityType: r.activityType,
    completedAt: r.completedAt.toISOString(),
    extraData: r.extraData,
  }));

  return { activities, total: activities.length };
}

// ─── 获取学习统计 ─────────────────────────────────────────────────────────────

export async function getProfileStats(
  db: Database,
  userId: string,
): Promise<ProfileStatsResult | null> {
  // 1. 获取 profile
  const profile = await getProfile(db, userId);
  if (!profile) return null;

  // 2. 获取 user_stats
  const statsRows = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId))
    .limit(1);

  const stats = statsRows[0] ?? null;
  const totalStudySeconds = stats?.totalStudySeconds ?? 0;
  const completedCoursesCount = stats?.completedCoursesCount ?? 0;
  const masteredNodesCount = stats?.masteredNodesCount ?? 0;

  // 3. 计算全局排名
  const totalUsersResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userStats);
  const totalUsers = totalUsersResult[0]?.count ?? 0;

  let globalRank: number | null = null;
  let rankPercentile: number | null = null;

  if (stats && totalUsers > 0) {
    // 统计学习时间比当前用户多的人数
    const aheadResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userStats)
      .where(gt(userStats.totalStudySeconds, totalStudySeconds));

    const usersAhead = aheadResult[0]?.count ?? 0;
    globalRank = usersAhead + 1;
    rankPercentile = Math.round(((totalUsers - globalRank + 1) / totalUsers) * 100);
  }

  // 4. 获取邀请码（不创建，仅查询已有的）
  const inviteRows = await db
    .select({ inviteCode: userInvites.inviteCode })
    .from(userInvites)
    .where(eq(userInvites.userId, userId))
    .limit(1);
  const inviteCode = inviteRows[0]?.inviteCode ?? null;

  // 5. 获取成功邀请数
  const inviteCountResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inviteBindings)
    .where(eq(inviteBindings.inviterId, userId));
  const successfulInvitesCount = inviteCountResult[0]?.count ?? 0;

  return {
    userName: profile.displayName || 'EvoBook Learner',
    joinedDate: profile.createdAt.toISOString(),
    totalStudyHours: Math.ceil(totalStudySeconds / 3600),
    totalStudySeconds,
    completedCoursesCount,
    masteredNodesCount,
    globalRank,
    rankPercentile,
    totalUsers,
    inviteCode,
    successfulInvitesCount,
  };
}
