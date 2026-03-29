import { eq, and } from 'drizzle-orm';
import { nodeProgress, courseMaps } from '../../db/schema';
import type { Database } from '../../db';

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
  status: string,
): Promise<NodeProgressItem> {
  const [row] = await db
    .insert(nodeProgress)
    .values({
      userId,
      courseMapId,
      nodeId,
      status: status as 'locked' | 'unlocked' | 'in_progress' | 'completed',
    })
    .onConflictDoUpdate({
      target: [nodeProgress.userId, nodeProgress.courseMapId, nodeProgress.nodeId],
      set: {
        status: status as 'locked' | 'unlocked' | 'in_progress' | 'completed',
        updatedAt: new Date(),
      },
    })
    .returning({
      nodeId: nodeProgress.nodeId,
      status: nodeProgress.status,
      updatedAt: nodeProgress.updatedAt,
    });

  // 节点完成时，自动解锁依赖该节点的后续节点
  if (status === 'completed') {
    await unlockDependentNodes(db, userId, courseMapId, nodeId);
  }

  return {
    nodeId: row.nodeId,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 检查并解锁所有前置条件已满足的后续节点。
 * 读取 course_maps.nodes JSONB 中的 pre_requisites 依赖关系。
 */
async function unlockDependentNodes(
  db: Database,
  userId: string,
  courseMapId: string,
  completedNodeId: number,
): Promise<void> {
  // 1. 获取课程的节点 DAG
  const [courseMap] = await db
    .select({ nodes: courseMaps.nodes })
    .from(courseMaps)
    .where(eq(courseMaps.id, courseMapId))
    .limit(1);

  if (!courseMap) return;
  const allNodes = courseMap.nodes as Array<{ id: number; pre_requisites: number[] }>;

  // 2. 找出依赖刚完成节点的所有后续节点
  const dependents = allNodes.filter(
    (n) => n.pre_requisites && n.pre_requisites.includes(completedNodeId),
  );
  if (dependents.length === 0) return;

  // 3. 获取当前所有进度
  const currentProgress = await getProgress(db, userId, courseMapId);
  const completedSet = new Set(
    currentProgress.filter((p) => p.status === 'completed').map((p) => p.nodeId),
  );

  // 4. 逐个检查后续节点是否所有前置都已完成
  for (const dep of dependents) {
    const allPrereqsCompleted = dep.pre_requisites.every((prereqId) =>
      completedSet.has(prereqId),
    );

    if (allPrereqsCompleted) {
      // 只解锁 locked 状态的节点（避免覆盖 in_progress/completed）
      const existing = currentProgress.find((p) => p.nodeId === dep.id);
      if (!existing || existing.status === 'locked') {
        await db
          .insert(nodeProgress)
          .values({
            userId,
            courseMapId,
            nodeId: dep.id,
            status: 'unlocked',
          })
          .onConflictDoUpdate({
            target: [nodeProgress.userId, nodeProgress.courseMapId, nodeProgress.nodeId],
            set: { status: 'unlocked', updatedAt: new Date() },
          });
        console.log(`[nodeProgress] Auto-unlocked node ${dep.id} for courseMap ${courseMapId}`);
      }
    }
  }
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
