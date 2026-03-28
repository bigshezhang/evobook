import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { listInventory, equipItem } from './service';

export const inventoryRouter = router({
  // 获取用户物品列表
  list: protectedProcedure
    .input(
      z.object({
        itemType: z.enum(['clothes', 'furniture']).optional(),
      }),
    )
    .query(({ ctx, input }) => {
      return listInventory(ctx.db, ctx.userId, input.itemType);
    }),

  // 装备/卸载物品
  equip: protectedProcedure
    .input(
      z.object({
        itemId: z.string().uuid(),
        equip: z.boolean(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return equipItem(ctx.db, ctx.userId, input.itemId, input.equip);
    }),
});
