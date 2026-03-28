import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { getOrCreateInviteCode, bindInviteCode } from './service';

export const inviteRouter = router({
  // 获取或创建用户的邀请码
  getInviteCode: protectedProcedure.query(async ({ ctx }) => {
    try {
      const result = await getOrCreateInviteCode(ctx.db, ctx.userId);
      console.log(`[invite.getInviteCode] user=${ctx.userId}, code=${result.inviteCode}`);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[invite.getInviteCode] Failed: user=${ctx.userId}, error=${message}`);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
    }
  }),

  // 绑定邀请码
  bindInvite: protectedProcedure
    .input(z.object({ inviteCode: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await bindInviteCode(ctx.db, ctx.userId, input.inviteCode);

      if (!result.success) {
        const errorMap: Record<string, { code: 'BAD_REQUEST' | 'CONFLICT' | 'NOT_FOUND'; message: string }> = {
          already_bound: { code: 'CONFLICT', message: 'You have already used an invite code' },
          invalid_code: { code: 'NOT_FOUND', message: 'Invalid invite code' },
          self_invite: { code: 'BAD_REQUEST', message: 'You cannot use your own invite code' },
        };
        const errInfo = errorMap[result.error!] ?? { code: 'BAD_REQUEST' as const, message: 'Failed to bind invite code' };
        throw new TRPCError({ code: errInfo.code, message: errInfo.message });
      }

      console.log(`[invite.bindInvite] user=${ctx.userId}, code=${input.inviteCode}, inviter=${result.inviterName}`);
      return result;
    }),
});
