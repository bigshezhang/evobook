import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import type { Database } from '../../db';
import { shopItems, userInventory, profiles } from '../../db/schema';

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

type ItemType = 'clothes' | 'furniture';

export interface InventoryItemView {
  itemId: string;
  name: string;
  itemType: string;
  imagePath: string;
  isEquipped: boolean;
  purchasedAt: Date | null;
}

// ─── 获取用户物品列表 ──────────────────────────────────────────────────────────

export async function listInventory(
  db: Database,
  userId: string,
  itemType?: ItemType,
): Promise<{ inventory: InventoryItemView[]; total: number }> {
  // 构建基础查询条件：用户匹配
  const conditions = [eq(userInventory.userId, userId)];
  if (itemType) {
    conditions.push(eq(shopItems.itemType, itemType));
  }

  const rows = await db
    .select({
      itemId: shopItems.id,
      name: shopItems.name,
      itemType: shopItems.itemType,
      imagePath: shopItems.imagePath,
      isEquipped: userInventory.isEquipped,
      purchasedAt: userInventory.purchasedAt,
    })
    .from(userInventory)
    .innerJoin(shopItems, eq(userInventory.itemId, shopItems.id))
    .where(and(...conditions));

  return { inventory: rows, total: rows.length };
}

// ─── 装备/卸载物品 ─────────────────────────────────────────────────────────────

export async function equipItem(
  db: Database,
  userId: string,
  itemId: string,
  equip: boolean,
): Promise<{ success: boolean }> {
  // 验证用户拥有此物品，同时获取物品信息
  const [invRow] = await db
    .select({
      inventoryId: userInventory.id,
      itemType: shopItems.itemType,
      imagePath: shopItems.imagePath,
    })
    .from(userInventory)
    .innerJoin(shopItems, eq(userInventory.itemId, shopItems.id))
    .where(
      and(eq(userInventory.userId, userId), eq(userInventory.itemId, itemId)),
    )
    .limit(1);

  if (!invRow) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Item not found in inventory',
    });
  }

  if (equip) {
    // 先卸载同类型已装备的物品
    const equippedSameType = await db
      .select({ invId: userInventory.id })
      .from(userInventory)
      .innerJoin(shopItems, eq(userInventory.itemId, shopItems.id))
      .where(
        and(
          eq(userInventory.userId, userId),
          eq(shopItems.itemType, invRow.itemType),
          eq(userInventory.isEquipped, true),
        ),
      );

    if (equippedSameType.length > 0) {
      const ids = equippedSameType.map((r) => r.invId);
      for (const id of ids) {
        await db
          .update(userInventory)
          .set({ isEquipped: false })
          .where(eq(userInventory.id, id));
      }
    }

    // 装备目标物品
    await db
      .update(userInventory)
      .set({ isEquipped: true })
      .where(
        and(
          eq(userInventory.userId, userId),
          eq(userInventory.itemId, itemId),
        ),
      );

    // 如果是衣服，更新 profile 的 currentOutfit
    if (invRow.itemType === 'clothes') {
      await db
        .update(profiles)
        .set({ currentOutfit: invRow.imagePath })
        .where(eq(profiles.id, userId));
    }

    console.log(
      `Equip item: user=${userId} item=${itemId} type=${invRow.itemType}`,
    );
  } else {
    // 卸载物品
    await db
      .update(userInventory)
      .set({ isEquipped: false })
      .where(
        and(
          eq(userInventory.userId, userId),
          eq(userInventory.itemId, itemId),
        ),
      );

    // 如果是衣服，恢复默认外观
    if (invRow.itemType === 'clothes') {
      await db
        .update(profiles)
        .set({ currentOutfit: 'default' })
        .where(eq(profiles.id, userId));
    }

    console.log(
      `Unequip item: user=${userId} item=${itemId} type=${invRow.itemType}`,
    );
  }

  return { success: true };
}
