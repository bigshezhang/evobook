import { eq, and } from 'drizzle-orm';
import { nodeProgress } from '../../db/schema';
import type { Database } from '../../db';

// 节点状态枚举
export const NODE_STATUS = ['locked', 'unlocked', 'in_progress', 'completed'] as const;
export type NodeStatus = (typeof NODE_STATUS)[number];

export interface NodeProgressItem {
  nodeId: number;
  status: string;
  updatedAt: string;
}

// ─── 获取课程地图的全部节点进度 ─────────────────────────────────────────────

export async function getProgress(
  db: Database,
  userId: string,
  courseMapId: string,
): Promise<NodeProgressItem[]> {
  const rows = await db
    .select({
      nodeId: nodeProgress.nodeId,
      status: nodeProgress.status,
      updatedAt: nodeProgress.updatedAt,
    })
    .from(nodeProgress)
    .where(
      and(
        eq(nodeProgress.userId, userId),
        eq(nodeProgress.courseMapId, courseMapId),
      ),
    );

  return rows.map((r) => ({
    nodeId: r.nodeId,
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

// ─── 单个节点进度 upsert ────────────────────────────────────────────────────

export async function upsertProgress(
  db: Database,
  userId: string,
  courseMapId: string,
  nodeId: number,
  status: NodeStatus,
): Promise<NodeProgressItem> {
  const [row] = await db
    .insert(nodeProgress)
    .values({ userId, courseMapId, nodeId, status })
    .onConflictDoUpdate({
      target: [nodeProgress.userId, nodeProgress.courseMapId, nodeProgress.nodeId],
      set: { status, updatedAt: new Date() },
    })
    .returning({
      nodeId: nodeProgress.nodeId,
      status: nodeProgress.status,
      updatedAt: nodeProgress.updatedAt,
    });

  return {
    nodeId: row.nodeId,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── 批量更新节点进度 ────────────────────────────────────────────────────────

export async function batchUpsertProgress(
  db: Database,
  userId: string,
  courseMapId: string,
  updates: Array<{ nodeId: number; status: NodeStatus }>,
): Promise<NodeProgressItem[]> {
  for (const u of updates) {
    await db
      .insert(nodeProgress)
      .values({ userId, courseMapId, nodeId: u.nodeId, status: u.status })
      .onConflictDoUpdate({
        target: [nodeProgress.userId, nodeProgress.courseMapId, nodeProgress.nodeId],
        set: { status: u.status, updatedAt: new Date() },
      });
  }

  // 返回该课程地图的完整进度列表
  return getProgress(db, userId, courseMapId);
}
