import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../../trpc';
import {
  listDiscoveryCourses,
  getDiscoveryCourse,
  incrementStartCount,
  joinCourse,
} from './service';

export const discoveryRouter = router({
  // 按 category 列出 discovery courses（公开接口）
  listCourses: publicProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const result = await listDiscoveryCourses(ctx.db, input?.category);
      console.log(`[discovery.listCourses] category=${input?.category ?? 'all'}, count=${result.total}`);
      return result;
    }),

  // 获取单个 discovery course（公开接口）
  getCourse: publicProcedure
    .input(z.object({ presetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const course = await getDiscoveryCourse(ctx.db, input.presetId);
      if (!course) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Discovery course '${input.presetId}' not found`,
        });
      }
      console.log(`[discovery.getCourse] presetId=${input.presetId}`);
      return course;
    }),

  // 增加 start_count（公开接口）
  startCourse: publicProcedure
    .input(z.object({ presetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const course = await getDiscoveryCourse(ctx.db, input.presetId);
      if (!course) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Discovery course '${input.presetId}' not found`,
        });
      }
      await incrementStartCount(ctx.db, input.presetId);
      console.log(`[discovery.startCourse] presetId=${input.presetId}`);
      return { presetId: input.presetId, message: 'Course started' };
    }),

  // 克隆 discovery course 到用户自己的 course_map（需登录）
  joinCourse: protectedProcedure
    .input(z.object({ presetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await joinCourse(ctx.db, ctx.userId, input.presetId);
        console.log(`[discovery.joinCourse] user=${ctx.userId}, presetId=${input.presetId}, courseMapId=${result.courseMapId}`);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (message.includes('not found')) {
          throw new TRPCError({ code: 'NOT_FOUND', message });
        }
        if (message.includes('no pre-built content')) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message });
        }

        console.error(`[discovery.joinCourse] Failed: user=${ctx.userId}, presetId=${input.presetId}, error=${message}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
      }
    }),
});
