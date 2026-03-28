import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { getCurrency, rollDice, claimReward, claimGift, earnExp } from './service';

export const gameRouter = router({
  // 获取金币、骰子、等级、经验
  getCurrency: protectedProcedure.query(async ({ ctx }) => {
    return getCurrency(ctx.db, ctx.userId);
  }),

  // 掷骰子
  rollDice: protectedProcedure
    .input(
      z.object({
        courseMapId: z.string().uuid(),
        currentPosition: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return rollDice(ctx.db, ctx.userId, input.courseMapId, input.currentPosition);
    }),

  // 领取奖励
  claimReward: protectedProcedure
    .input(
      z.object({
        rewardType: z.enum(['gold', 'dice', 'gift']),
        amount: z.number().int().positive(),
        source: z.string(),
        sourceDetails: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return claimReward(
        ctx.db,
        ctx.userId,
        input.rewardType,
        input.amount,
        input.source,
        input.sourceDetails,
      );
    }),

  // 领取礼物
  claimGift: protectedProcedure
    .input(
      z.object({
        sourceDetails: z.record(z.unknown()).optional(),
      }).optional(),
    )
    .mutation(async ({ ctx, input }) => {
      return claimGift(ctx.db, ctx.userId, input?.sourceDetails);
    }),

  // 获得经验
  earnExp: protectedProcedure
    .input(
      z.object({
        expAmount: z.number().int().positive(),
        goldReward: z.number().int().min(0).optional().default(0),
        diceReward: z.number().int().min(0).optional().default(0),
        source: z.string(),
        sourceDetails: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return earnExp(
        ctx.db,
        ctx.userId,
        input.expAmount,
        input.source,
        input.goldReward,
        input.diceReward,
        input.sourceDetails,
      );
    }),
});
