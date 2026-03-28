import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, optionalAuthProcedure } from '../../trpc';
import { processOnboardingNext } from './service';

export const onboardingRouter = router({
  // 处理 onboarding 多轮对话的下一步交互
  next: optionalAuthProcedure
    .input(
      z.object({
        sessionId: z.string().uuid().optional(),
        userMessage: z.string().optional(),
        userChoice: z.string().optional(),
        initialTopic: z.string().optional(),
        discoveryPresetId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await processOnboardingNext(ctx.db, input, ctx.userId);
        console.log(`[onboarding.next] type=${result.type}, sessionId=${result.sessionId}`);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (message.includes('not found')) {
          throw new TRPCError({ code: 'NOT_FOUND', message });
        }

        console.error(`[onboarding.next] Failed: ${message}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
      }
    }),
});
