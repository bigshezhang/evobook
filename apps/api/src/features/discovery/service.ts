import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '../../db';
import {
  discoveryCourses,
  courseMaps,
  nodeContents,
  nodeProgress,
  profiles,
} from '../../db/schema';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface DiscoveryCourseItem {
  id: string;
  presetId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  rating: string;
  seedContext: unknown;
}

export interface JoinCourseResult {
  courseMapId: string;
  message: string;
}

// ─── 列出 Discovery Courses ──────────────────────────────────────────────────

export async function listDiscoveryCourses(
  db: Database,
  category?: string,
): Promise<{ courses: DiscoveryCourseItem[]; total: number }> {
  const conditions = [eq(discoveryCourses.isActive, true)];
  if (category) {
    conditions.push(eq(discoveryCourses.category, category));
  }

  const rows = await db
    .select({
      id: discoveryCourses.id,
      presetId: discoveryCourses.presetId,
      title: discoveryCourses.title,
      description: discoveryCourses.description,
      imageUrl: discoveryCourses.imageUrl,
      category: discoveryCourses.category,
      rating: discoveryCourses.rating,
      seedContext: discoveryCourses.seedContext,
    })
    .from(discoveryCourses)
    .where(and(...conditions))
    .orderBy(discoveryCourses.displayOrder);

  return { courses: rows, total: rows.length };
}

// ─── 获取单个 Discovery Course ────────────────────────────────────────────────

export async function getDiscoveryCourse(
  db: Database,
  presetId: string,
): Promise<DiscoveryCourseItem | null> {
  const rows = await db
    .select({
      id: discoveryCourses.id,
      presetId: discoveryCourses.presetId,
      title: discoveryCourses.title,
      description: discoveryCourses.description,
      imageUrl: discoveryCourses.imageUrl,
      category: discoveryCourses.category,
      rating: discoveryCourses.rating,
      seedContext: discoveryCourses.seedContext,
    })
    .from(discoveryCourses)
    .where(
      and(
        eq(discoveryCourses.presetId, presetId),
        eq(discoveryCourses.isActive, true),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

// ─── 增加 start_count ────────────────────────────────────────────────────────

export async function incrementStartCount(
  db: Database,
  presetId: string,
): Promise<void> {
  await db
    .update(discoveryCourses)
    .set({ startCount: sql`${discoveryCourses.startCount} + 1` })
    .where(eq(discoveryCourses.presetId, presetId));
}

// ─── 加入课程（完整克隆） ─────────────────────────────────────────────────────

export async function joinCourse(
  db: Database,
  userId: string,
  presetId: string,
): Promise<JoinCourseResult> {
  // 1. 查找 discovery course
  const dcRows = await db
    .select()
    .from(discoveryCourses)
    .where(
      and(
        eq(discoveryCourses.presetId, presetId),
        eq(discoveryCourses.isActive, true),
      ),
    )
    .limit(1);

  const dc = dcRows[0];
  if (!dc) {
    throw new Error(`Discovery course '${presetId}' not found`);
  }

  // 2. 验证 nodes 和 mapMeta 不为空
  const nodes = dc.nodes as Array<Record<string, unknown>> | null;
  const mapMeta = dc.mapMeta as Record<string, unknown> | null;
  if (!nodes || nodes.length === 0 || !mapMeta) {
    throw new Error(`Discovery course '${presetId}' has no pre-built content yet`);
  }

  // 3. 从 seed_context 提取数据，克隆到 course_maps
  const seed = (dc.seedContext as Record<string, unknown>) ?? {};
  const newCourseMapId = crypto.randomUUID();

  await db.insert(courseMaps).values({
    id: newCourseMapId,
    userId,
    topic: (seed.topic as string) || dc.title,
    level: (seed.suggested_level as string) || (seed.level as string) || 'Beginner',
    focus: (seed.focus as string) || '',
    verifiedConcept: (seed.verified_concept as string) || (seed.topic as string) || dc.title,
    mode: 'Deep',
    language: (seed.language as string) || 'en',
    totalCommitmentMinutes: (mapMeta.total_commitment_minutes as number) ?? 60,
    mapMeta,
    nodes,
  });

  // 4. 克隆 node_contents（从 source_course_map_id 对应的内容）
  if (dc.sourceCourseMapId) {
    const sourceContents = await db
      .select()
      .from(nodeContents)
      .where(eq(nodeContents.courseMapId, dc.sourceCourseMapId));

    for (const nc of sourceContents) {
      await db.insert(nodeContents).values({
        courseMapId: newCourseMapId,
        nodeId: nc.nodeId,
        contentType: nc.contentType,
        questionKey: nc.questionKey,
        contentJson: nc.contentJson,
        generationStatus: nc.generationStatus,
        generationStartedAt: nc.generationStartedAt,
        generationCompletedAt: nc.generationCompletedAt,
        generationError: nc.generationError,
        nodeType: nc.nodeType,
      });
    }
  }

  // 5. 为所有 learn 节点创建 node_progress 记录
  //    无前置依赖的节点设为 unlocked，其他设为 locked
  const noPrereqIds = new Set(
    nodes
      .filter((n) => {
        const prereqs = n.pre_requisites as unknown[] | undefined;
        return !prereqs || prereqs.length === 0;
      })
      .map((n) => n.id as number),
  );

  for (const node of nodes) {
    const nodeId = node.id as number;
    const status = noPrereqIds.has(nodeId) ? 'unlocked' : 'locked';
    await db.insert(nodeProgress).values({
      userId,
      courseMapId: newCourseMapId,
      nodeId,
      status,
    });
  }

  // 6. 设为用户的 active course
  await db
    .update(profiles)
    .set({ activeCourseMapId: newCourseMapId })
    .where(eq(profiles.id, userId));

  // 7. 增加 start_count
  await incrementStartCount(db, presetId);

  console.log(`[discovery.joinCourse] user=${userId}, presetId=${presetId}, newCourseMapId=${newCourseMapId}`);

  return {
    courseMapId: newCourseMapId,
    message: 'Course joined! You can start learning now.',
  };
}
