import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, optionalAuthProcedure, protectedProcedure } from '../../trpc';
import {
  generateCourseMap,
  listCourseMaps,
  getCourseMapDetail,
  getGenerationProgress,
} from './service';

export const courseMapRouter = router({
  // 生成课程路径 DAG（登录可选：匿名用户也可以生成预览）
  generate: optionalAuthProcedure
    .input(
      z.object({
        topic: z.string().min(1),
        level: z.string().min(1),
        focus: z.string().min(1),
        verifiedConcept: z.string().min(1),
        mode: z.string().min(1),
        totalCommitmentMinutes: z.number().int().positive(),
        interestedConcepts: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await generateCourseMap(ctx.db, input, ctx.userId);
        console.log(`[courseMap.generate] courseMapId=${result.courseMapId}, userId=${ctx.userId}, nodes=${result.nodes.length}`);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[courseMap.generate] Failed: ${message}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
      }
    }),

  // 获取用户所有课程列表（需登录）
  list: protectedProcedure.query(async ({ ctx }) => {
    const result = await listCourseMaps(ctx.db, ctx.userId);
    return result;
  }),

  // 获取课程详情（需登录）
  getDetail: protectedProcedure
    .input(z.object({ courseMapId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const detail = await getCourseMapDetail(ctx.db, ctx.userId, input.courseMapId);
      if (!detail) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Course map '${input.courseMapId}' not found`,
        });
      }
      return detail;
    }),

  // 获取内容生成进度（需登录）
  getGenerationProgress: protectedProcedure
    .input(z.object({ courseMapId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const progress = await getGenerationProgress(ctx.db, ctx.userId, input.courseMapId);
      if (!progress) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Course map '${input.courseMapId}' not found`,
        });
      }
      return progress;
    }),
});
