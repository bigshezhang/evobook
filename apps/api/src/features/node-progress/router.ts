import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { getProgress, upsertProgress, batchUpsertProgress, NODE_STATUS } from './service';

const nodeStatusEnum = z.enum(NODE_STATUS);

export const nodeProgressRouter = router({
  // 获取 course map 的节点进度
  get: protectedProcedure
    .input(z.object({ courseMapId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const progress = await getProgress(ctx.db, ctx.userId, input.courseMapId);
      return { progress };
    }),

  // 更新单个节点进度（upsert）
  update: protectedProcedure
    .input(
      z.object({
        courseMapId: z.string().uuid(),
        nodeId: z.number().int(),
        status: nodeStatusEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await upsertProgress(
        ctx.db,
        ctx.userId,
        input.courseMapId,
        input.nodeId,
        input.status,
      );
      return result;
    }),

  // 批量更新节点进度
  batchUpdate: protectedProcedure
    .input(
      z.object({
        courseMapId: z.string().uuid(),
        updates: z
          .array(
            z.object({
              nodeId: z.number().int(),
              status: nodeStatusEnum,
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const progress = await batchUpsertProgress(
        ctx.db,
        ctx.userId,
        input.courseMapId,
        input.updates,
      );
      return { progress };
    }),
});
