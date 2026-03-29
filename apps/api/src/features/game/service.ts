import { eq, and, notInArray, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { profiles, gameTransactions, shopItems, userInventory } from '../../db/schema';
import type { Database } from '../../db';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const DICE_MIN = 1;
const DICE_MAX = 6;
const LEVEL_UP_GOLD_BONUS = 100;
const LEVEL_UP_DICE_BONUS = 2;
const FALLBACK_GIFT_GOLD = 200;

// ─── 辅助：计算升到下一级所需经验 ────────────────────────────────────────────

function expToNextLevel(level: number): number {
  return level * 100;
}

// ─── 辅助：获取并校验 profile ────────────────────────────────────────────────

async function getProfileOrThrow(db: Database, userId: string) {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User profile not found' });
  }
  return profile;
}

// ─── 辅助：记录 game transaction ─────────────────────────────────────────────

async function recordTransaction(
  db: Database,
  userId: string,
  transactionType: string,
  amount: number,
  source: string,
  sourceDetail?: Record<string, unknown>,
  balanceAfter?: number,
) {
  await db.insert(gameTransactions).values({
    userId,
    transactionType: transactionType as 'earn_gold' | 'spend_gold' | 'earn_dice' | 'use_dice' | 'earn_exp' | 'earn_item' | 'earn_gift',
    amount,
    source,
    sourceDetail: sourceDetail ?? null,
    balanceAfter: balanceAfter ?? null,
  });
}

// ─── getCurrency ─────────────────────────────────────────────────────────────

export async function getCurrency(db: Database, userId: string) {
  const profile = await getProfileOrThrow(db, userId);
  const expNeeded = expToNextLevel(profile.level);

  return {
    goldBalance: profile.goldBalance,
    diceRollsCount: profile.diceRollsCount,
    level: profile.level,
    currentExp: profile.currentExp,
    expToNextLevel: expNeeded,
    expProgressPercent: expNeeded > 0
      ? Math.round((profile.currentExp / expNeeded) * 1000) / 10
      : 0,
  };
}

// ─── rollDice ────────────────────────────────────────────────────────────────

export async function rollDice(
  db: Database,
  userId: string,
  courseMapId: string,
  currentPosition: number,
) {
  const profile = await getProfileOrThrow(db, userId);

  if (profile.diceRollsCount <= 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No dice rolls available' });
  }

  const diceResult = Math.floor(Math.random() * (DICE_MAX - DICE_MIN + 1)) + DICE_MIN;
  const newPosition = currentPosition + diceResult;
  const newDiceCount = profile.diceRollsCount - 1;

  await db
    .update(profiles)
    .set({
      diceRollsCount: newDiceCount,
      travelBoardPosition: newPosition,
    })
    .where(eq(profiles.id, userId));

  await recordTransaction(db, userId, 'use_dice', -1, 'dice_roll', {
    diceResult,
    courseMapId,
    currentPosition,
    newPosition,
  }, newDiceCount);

  console.log(`Dice rolled: userId=${userId}, result=${diceResult}, remaining=${newDiceCount}`);

  return {
    diceResult,
    diceRollsRemaining: newDiceCount,
    newPosition,
  };
}

// ─── claimReward ─────────────────────────────────────────────────────────────

export async function claimReward(
  db: Database,
  userId: string,
  rewardType: 'gold' | 'dice' | 'gift',
  amount: number,
  source: string,
  sourceDetails?: Record<string, unknown>,
) {
  const profile = await getProfileOrThrow(db, userId);

  let newBalance: number;

  if (rewardType === 'gold') {
    newBalance = profile.goldBalance + amount;
    await db
      .update(profiles)
      .set({ goldBalance: newBalance })
      .where(eq(profiles.id, userId));
  } else if (rewardType === 'dice') {
    newBalance = profile.diceRollsCount + amount;
    await db
      .update(profiles)
      .set({ diceRollsCount: newBalance })
      .where(eq(profiles.id, userId));
  } else {
    newBalance = profile.goldBalance + amount;
    await db
      .update(profiles)
      .set({ goldBalance: newBalance })
      .where(eq(profiles.id, userId));
  }

  await recordTransaction(
    db, userId, `earn_${rewardType}`, amount, source, sourceDetails, newBalance,
  );

  console.log(`Reward claimed: userId=${userId}, type=${rewardType}, amount=${amount}, newBalance=${newBalance}`);

  return { success: true, newBalance };
}

// ─── claimGift ───────────────────────────────────────────────────────────────

export async function claimGift(
  db: Database,
  userId: string,
  sourceDetails?: Record<string, unknown>,
) {
  // 获取用户已拥有的物品 ID
  const ownedRows = await db
    .select({ itemId: userInventory.itemId })
    .from(userInventory)
    .where(eq(userInventory.userId, userId));
  const ownedIds = ownedRows.map((r) => r.itemId);

  // 查询未拥有的物品
  let unownedItems;
  if (ownedIds.length > 0) {
    unownedItems = await db
      .select()
      .from(shopItems)
      .where(notInArray(shopItems.id, ownedIds));
  } else {
    unownedItems = await db.select().from(shopItems);
  }

  // 全部拥有 → 给金币
  if (unownedItems.length === 0) {
    const profile = await getProfileOrThrow(db, userId);
    const newGold = profile.goldBalance + FALLBACK_GIFT_GOLD;

    await db
      .update(profiles)
      .set({ goldBalance: newGold })
      .where(eq(profiles.id, userId));

    await recordTransaction(
      db, userId, 'earn_gold', FALLBACK_GIFT_GOLD,
      'gift_fallback_all_owned', sourceDetails, newGold,
    );

    console.log(`Gift fallback to gold: userId=${userId}, goldAmount=${FALLBACK_GIFT_GOLD}`);

    return {
      success: true,
      rewardType: 'gold' as const,
      goldAmount: FALLBACK_GIFT_GOLD,
      item: null,
      message: 'You already own all items! Here\'s some gold instead.',
    };
  }

  // 随机选一个
  const chosen = unownedItems[Math.floor(Math.random() * unownedItems.length)];

  // 添加到用户库存
  await db.insert(userInventory).values({
    userId,
    itemId: chosen.id,
  });

  await recordTransaction(db, userId, 'earn_item', 1, 'tile_gift', {
    ...(sourceDetails ?? {}),
    itemId: chosen.id,
    itemName: chosen.name,
    itemType: chosen.itemType,
  });

  console.log(`Gift item granted: userId=${userId}, itemId=${chosen.id}, itemName=${chosen.name}`);

  return {
    success: true,
    rewardType: 'item' as const,
    goldAmount: null,
    item: {
      id: chosen.id,
      name: chosen.name,
      itemType: chosen.itemType,
      imagePath: chosen.imagePath,
      rarity: chosen.rarity,
    },
    message: `You received: ${chosen.name}!`,
  };
}

// ─── earnExp ─────────────────────────────────────────────────────────────────

export async function earnExp(
  db: Database,
  userId: string,
  expAmount: number,
  source: string,
  goldReward: number = 0,
  diceReward: number = 0,
  sourceDetails?: Record<string, unknown>,
) {
  const profile = await getProfileOrThrow(db, userId);

  let currentExp = profile.currentExp + expAmount;
  let currentLevel = profile.level;
  let levelUp = false;
  let totalGoldReward = goldReward;
  let totalDiceReward = diceReward;
  let levelsGained = 0;

  // 升级循环
  while (true) {
    const needed = expToNextLevel(currentLevel);
    if (currentExp >= needed) {
      currentExp -= needed;
      currentLevel += 1;
      levelUp = true;
      levelsGained += 1;
      totalGoldReward += LEVEL_UP_GOLD_BONUS;
      totalDiceReward += LEVEL_UP_DICE_BONUS;
      console.log(`User leveled up: userId=${userId}, oldLevel=${currentLevel - 1}, newLevel=${currentLevel}`);
    } else {
      break;
    }
  }

  // 更新 profile
  const updateSet: Record<string, unknown> = {
    currentExp,
    level: currentLevel,
  };

  if (totalGoldReward > 0) {
    updateSet.goldBalance = sql`${profiles.goldBalance} + ${totalGoldReward}`;
  }
  if (totalDiceReward > 0) {
    updateSet.diceRollsCount = sql`${profiles.diceRollsCount} + ${totalDiceReward}`;
  }

  await db.update(profiles).set(updateSet).where(eq(profiles.id, userId));

  // 记录交易
  await recordTransaction(db, userId, 'earn_exp', expAmount, source, {
    ...(sourceDetails ?? {}),
    levelsGained,
  });

  if (totalGoldReward > 0) {
    await recordTransaction(db, userId, 'earn_gold', totalGoldReward, source, {
      baseGold: goldReward,
      levelUpGold: totalGoldReward - goldReward,
      levelsGained,
    });
  }

  if (totalDiceReward > 0) {
    await recordTransaction(db, userId, 'earn_dice', totalDiceReward, source, {
      baseDice: diceReward,
      levelUpDice: totalDiceReward - diceReward,
      levelsGained,
    });
  }

  console.log(
    `EXP earned: userId=${userId}, amount=${expAmount}, source=${source}, ` +
    `level=${currentLevel}, levelUp=${levelUp}, levelsGained=${levelsGained}`,
  );

  return {
    success: true,
    expEarned: expAmount,
    currentExp,
    currentLevel,
    levelUp,
    rewards: {
      gold: totalGoldReward,
      diceRolls: totalDiceReward,
    },
  };
}
