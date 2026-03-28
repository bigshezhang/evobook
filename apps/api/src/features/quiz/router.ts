import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { saveDraft, getDraft, submitQuiz, getHistory, getAttemptDetail } from './service';

export const quizRouter = router({
  // 保存 quiz 草稿
  saveDraft: protectedProcedure
    .input(
      z.object({
        courseMapId: z.string().uuid(),
        nodeId: z.number().int(),
        quizJson: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return saveDraft(ctx.db, ctx.userId, input.courseMapId, input.nodeId, input.quizJson);
    }),

  // 获取草稿
  getDraft: protectedProcedure
    .input(
      z.object({
        courseMapId: z.string().uuid(),
        nodeId: z.number().int(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const draft = await getDraft(ctx.db, ctx.userId, input.courseMapId, input.nodeId);
      if (!draft) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz draft not found' });
      }
      return draft;
    }),

  // 提交 quiz
  submit: protectedProcedure
    .input(
      z.object({
        courseMapId: z.string().uuid(),
        nodeId: z.number().int(),
        quizJson: z.record(z.unknown()),
        score: z.number().int().min(0).max(100),
        attemptId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return submitQuiz(
        ctx.db,
        ctx.userId,
        input.courseMapId,
        input.nodeId,
        input.quizJson,
        input.score,
        input.attemptId,
      );
    }),

  // 获取 quiz 历史
  getHistory: protectedProcedure
    .input(
      z.object({
        courseMapId: z.string().uuid(),
        nodeId: z.number().int(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const attempts = await getHistory(ctx.db, ctx.userId, input.courseMapId, input.nodeId);
      return { attempts };
    }),

  // 获取 quiz 详情
  getAttemptDetail: protectedProcedure
    .input(z.object({ attemptId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const attempt = await getAttemptDetail(ctx.db, ctx.userId, input.attemptId);
      if (!attempt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz attempt not found' });
      }
      return attempt;
    }),
});
