import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { handleHeartbeat } from './service';

export const learningSessionRouter = router({
  // 前端每 30 秒发送一次学习心跳
  heartbeat: protectedProcedure
    .input(
      z.object({
        courseMapId: z.string().uuid(),
        nodeId: z.number().int(),
        clientTimestamp: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return handleHeartbeat(
        ctx.db,
        ctx.userId,
        input.courseMapId,
        input.nodeId,
        input.clientTimestamp,
      );
    }),
});
