import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import type { Database } from '../../db';
import {
  shopItems,
  userInventory,
  profiles,
  gameTransactions,
} from '../../db/schema';

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

type ItemType = 'clothes' | 'furniture';

export interface ShopItemView {
  id: string;
  name: string;
  itemType: string;
  price: number;
  imagePath: string;
  rarity: string;
  owned: boolean;
  isEquipped: boolean;
}

export interface PurchaseResult {
  success: boolean;
  newGoldBalance: number;
  inventoryItemId: string;
}

// ─── 获取商店物品列表 ──────────────────────────────────────────────────────────

export async function getShopItems(
  db: Database,
  userId: string,
  itemType: ItemType,
): Promise<{ items: ShopItemView[]; total: number }> {
  // 查询指定类型的所有商店物品
  const items = await db
    .select()
    .from(shopItems)
    .where(eq(shopItems.itemType, itemType));

  // 查询用户已拥有的物品
  const ownedItems = await db
    .select({
      itemId: userInventory.itemId,
      isEquipped: userInventory.isEquipped,
    })
    .from(userInventory)
    .where(eq(userInventory.userId, userId));

  const ownedMap = new Map(
    ownedItems.map((inv) => [inv.itemId, inv.isEquipped]),
  );

  const result: ShopItemView[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    itemType: item.itemType,
    price: item.price,
    imagePath: item.imagePath,
    rarity: item.rarity,
    owned: ownedMap.has(item.id),
    isEquipped: ownedMap.get(item.id) ?? false,
  }));

  return { items: result, total: result.length };
}

// ─── 购买物品 ──────────────────────────────────────────────────────────────────

export async function purchaseItem(
  db: Database,
  userId: string,
  itemId: string,
): Promise<PurchaseResult> {
  // 验证物品存在
  const [item] = await db
    .select()
    .from(shopItems)
    .where(eq(shopItems.id, itemId))
    .limit(1);

  if (!item) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Item not found',
    });
  }

  // 验证未拥有
  const [existing] = await db
    .select({ id: userInventory.id })
    .from(userInventory)
    .where(
      and(eq(userInventory.userId, userId), eq(userInventory.itemId, itemId)),
    )
    .limit(1);

  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Item already owned',
    });
  }

  // 验证金币足够
  const [profile] = await db
    .select({ goldBalance: profiles.goldBalance })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile || profile.goldBalance < item.price) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Insufficient gold balance',
    });
  }

  // 扣金币
  const newBalance = profile.goldBalance - item.price;
  await db
    .update(profiles)
    .set({ goldBalance: newBalance })
    .where(eq(profiles.id, userId));

  // 创建库存记录
  const [inventoryRow] = await db
    .insert(userInventory)
    .values({ userId, itemId })
    .returning({ id: userInventory.id });

  // 记录交易
  await db.insert(gameTransactions).values({
    userId,
    transactionType: 'spend_gold' as const,
    amount: -item.price,
    balanceAfter: newBalance,
    source: 'shop_purchase',
    sourceDetail: { itemId: item.id, itemName: item.name },
  });

  console.log(
    `Shop purchase: user=${userId} item=${itemId} cost=${item.price} newBalance=${newBalance}`,
  );

  return {
    success: true,
    newGoldBalance: newBalance,
    inventoryItemId: inventoryRow.id,
  };
}
