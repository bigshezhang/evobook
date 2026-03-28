import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { getShopItems, purchaseItem } from './service';

export const shopRouter = router({
  // 获取商店物品列表
  getItems: protectedProcedure
    .input(
      z.object({
        itemType: z.enum(['clothes', 'furniture']),
      }),
    )
    .query(({ ctx, input }) => {
      return getShopItems(ctx.db, ctx.userId, input.itemType);
    }),

  // 购买物品
  purchase: protectedProcedure
    .input(
      z.object({
        itemId: z.string().uuid(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return purchaseItem(ctx.db, ctx.userId, input.itemId);
    }),
});
