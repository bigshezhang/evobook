import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import {
  getProfile,
  updateProfile,
  getActiveCourseMapId,
  setActiveCourseMap,
  getLearningActivities,
  getProfileStats,
} from './service';

export const profileRouter = router({
  // 获取当前用户 profile
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getProfile(ctx.db, ctx.userId);
    if (!profile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    }
    console.log(`[profile.get] Fetched profile for user=${ctx.userId}`);
    return profile;
  }),

  // 更新 profile（部分字段）
  update: protectedProcedure
    .input(
      z.object({
        displayName: z.string().optional(),
        mascot: z.string().optional(),
        onboardingCompleted: z.boolean().optional(),
        guidesCompleted: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await updateProfile(ctx.db, ctx.userId, input);
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }
      console.log(`[profile.update] Updated profile for user=${ctx.userId}, fields=${Object.keys(input).join(',')}`);
      return updated;
    }),

  // 获取用户当前活跃课程 ID
  getActiveCourse: protectedProcedure.query(async ({ ctx }) => {
    const courseMapId = await getActiveCourseMapId(ctx.db, ctx.userId);
    console.log(`[profile.getActiveCourse] user=${ctx.userId}, courseMapId=${courseMapId}`);
    return { courseMapId };
  }),

  // 设置活跃课程
  setActiveCourse: protectedProcedure
    .input(z.object({ courseMapId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await setActiveCourseMap(ctx.db, ctx.userId, input.courseMapId);
      console.log(`[profile.setActiveCourse] user=${ctx.userId}, courseMapId=${input.courseMapId}`);
      return { success: true };
    }),

  // 获取过去 N 天的学习活动
  getLearningActivities: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(180) }))
    .query(async ({ ctx, input }) => {
      const result = await getLearningActivities(ctx.db, ctx.userId, input.days);
      console.log(`[profile.getLearningActivities] user=${ctx.userId}, days=${input.days}, count=${result.total}`);
      return result;
    }),

  // 获取学习统计
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getProfileStats(ctx.db, ctx.userId);
    if (!stats) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    }
    console.log(`[profile.getStats] user=${ctx.userId}, rank=${stats.globalRank}`);
    return stats;
  }),
});
