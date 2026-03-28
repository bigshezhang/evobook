import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../db';
import {
  userInvites,
  inviteBindings,
  userRewards,
  profiles,
} from '../../db/schema';

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_MAX_RETRIES = 10;
const INVITE_XP_REWARD = 500;
const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface InviteCodeResult {
  inviteCode: string;
  formattedCode: string;
  successfulInvitesCount: number;
}

export interface BindInviteResult {
  success: boolean;
  inviterName?: string | null;
  reward?: { xpEarned: number; message: string } | null;
  error?: string;
}

// ─── 生成随机邀请码（6位大写字母+数字） ───────────────────────────────────────

function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS.charAt(
      Math.floor(Math.random() * INVITE_CODE_CHARS.length),
    );
  }
  return code;
}

// ─── 获取或创建邀请码 ─────────────────────────────────────────────────────────

export async function getOrCreateInviteCode(
  db: Database,
  userId: string,
): Promise<InviteCodeResult> {
  // 查询已有邀请码
  const existing = await db
    .select({ inviteCode: userInvites.inviteCode })
    .from(userInvites)
    .where(eq(userInvites.userId, userId))
    .limit(1);

  let inviteCode: string;

  if (existing.length > 0) {
    inviteCode = existing[0].inviteCode;
    console.log(`[invite.getOrCreate] Found existing code for user=${userId}`);
  } else {
    // 生成新的唯一邀请码（碰撞检测）
    for (let attempt = 0; attempt < INVITE_CODE_MAX_RETRIES; attempt++) {
      const candidate = generateInviteCode();
      const collision = await db
        .select({ id: userInvites.id })
        .from(userInvites)
        .where(eq(userInvites.inviteCode, candidate))
        .limit(1);

      if (collision.length === 0) {
        inviteCode = candidate;
        await db.insert(userInvites).values({ userId, inviteCode });
        console.log(`[invite.getOrCreate] Created new code for user=${userId}, code=${inviteCode}`);
        break;
      }
    }

    // 如果循环结束还没有赋值，说明生成失败
    if (!inviteCode!) {
      throw new Error(`Failed to generate unique invite code after ${INVITE_CODE_MAX_RETRIES} attempts`);
    }
  }

  // 统计成功邀请数
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inviteBindings)
    .where(eq(inviteBindings.inviterId, userId));
  const successfulInvitesCount = countResult[0]?.count ?? 0;

  return {
    inviteCode,
    formattedCode: `EvoBook#${inviteCode}`,
    successfulInvitesCount,
  };
}

// ─── 绑定邀请码 ──────────────────────────────────────────────────────────────

export async function bindInviteCode(
  db: Database,
  inviteeId: string,
  inviteCode: string,
): Promise<BindInviteResult> {
  // 1. 检查是否已经绑定过
  const existingBinding = await db
    .select({ id: inviteBindings.id })
    .from(inviteBindings)
    .where(eq(inviteBindings.inviteeId, inviteeId))
    .limit(1);

  if (existingBinding.length > 0) {
    console.log(`[invite.bind] User already bound, inviteeId=${inviteeId}`);
    return { success: false, error: 'already_bound' };
  }

  // 2. 验证邀请码是否存在
  const inviteRows = await db
    .select({ userId: userInvites.userId })
    .from(userInvites)
    .where(eq(userInvites.inviteCode, inviteCode.toUpperCase()))
    .limit(1);

  if (inviteRows.length === 0) {
    console.log(`[invite.bind] Invalid invite code=${inviteCode}`);
    return { success: false, error: 'invalid_code' };
  }

  const inviterId = inviteRows[0].userId;

  // 3. 不能自己邀请自己
  if (inviterId === inviteeId) {
    console.log(`[invite.bind] Self-invite attempt, userId=${inviteeId}`);
    return { success: false, error: 'self_invite' };
  }

  // 4. 创建绑定记录
  await db.insert(inviteBindings).values({
    inviterId,
    inviteeId,
    inviteCode: inviteCode.toUpperCase(),
    xpGranted: true,
  });

  // 5. 赠送 XP 奖励（双方各 500 XP）
  await db.insert(userRewards).values({
    userId: inviterId,
    rewardType: 'invite_referrer',
    amount: INVITE_XP_REWARD,
    sourceType: 'invite',
    sourceId: inviteeId,
  });
  await db.insert(userRewards).values({
    userId: inviteeId,
    rewardType: 'invite_referee',
    amount: INVITE_XP_REWARD,
    sourceType: 'invite',
    sourceId: inviterId,
  });

  // 6. 获取邀请人名称
  const inviterProfile = await db
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.id, inviterId))
    .limit(1);

  const inviterName = inviterProfile[0]?.displayName || 'EvoBook User';

  console.log(`[invite.bind] Binding created, inviterId=${inviterId}, inviteeId=${inviteeId}, code=${inviteCode}`);

  return {
    success: true,
    inviterName,
    reward: {
      xpEarned: INVITE_XP_REWARD,
      message: `You and ${inviterName} both earned +${INVITE_XP_REWARD} XP!`,
    },
  };
}
