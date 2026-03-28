import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, optionalAuthProcedure } from '../../trpc';
import { getKnowledgeCard, getClarification, getQADetail } from './service';

const courseContextSchema = z.object({
  courseName: z.string(),
  courseContext: z.string(),
  topic: z.string(),
  level: z.string(),
  mode: z.string(),
});

const nodeInfoSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string(),
  type: z.string(),
  estimatedMinutes: z.number(),
});

export const nodeContentRouter = router({
  // 生成/获取知识卡片
  getKnowledgeCard: optionalAuthProcedure
    .input(
      z.object({
        language: z.string(),
        courseMapId: z.string().uuid(),
        course: courseContextSchema,
        node: nodeInfoSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await getKnowledgeCard(ctx.db, input);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[nodeContent.getKnowledgeCard] Failed: courseMapId=${input.courseMapId}, nodeId=${input.node.id}, error=${message}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
      }
    }),

  // 生成澄清回答
  getClarification: optionalAuthProcedure
    .input(
      z.object({
        language: z.string(),
        userQuestionRaw: z.string().min(1),
        pageMarkdown: z.string(),
        courseMapId: z.string().uuid().optional(),
        nodeId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await getClarification(ctx.db, input);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[nodeContent.getClarification] Failed: ${message}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
      }
    }),

  // 生成详细 QA
  getQADetail: optionalAuthProcedure
    .input(
      z.object({
        language: z.string(),
        qaTitle: z.string().min(1),
        qaShortAnswer: z.string(),
        courseMapId: z.string().uuid().optional(),
        nodeId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await getQADetail(ctx.db, input);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[nodeContent.getQADetail] Failed: ${message}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
      }
    }),
});
