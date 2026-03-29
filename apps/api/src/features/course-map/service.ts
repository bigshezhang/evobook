import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type { Database } from '../../db';
import { courseMaps, nodeContents, nodeProgress, profiles } from '../../db/schema';
import type { DAGNodeJson, MapMetaJson } from '../../db/schema';
import { completeLLM } from '../../lib/llm';
import { loadPrompt } from '../../lib/prompts';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface GenerateCourseMapInput {
  topic: string;
  level: string;
  focus: string;
  verifiedConcept: string;
  mode: string;
  totalCommitmentMinutes: number;
  interestedConcepts?: string[];
}

export interface CourseMapNode {
  id: number;
  title: string;
  description: string;
  type: string;
  estimated_minutes: number;
  pre_requisites: number[];
  layer?: number;
}

export interface CourseMapMeta {
  totalNodes: number;
  totalMinutes: number;
  difficulty: string;
  [key: string]: unknown;
}

export interface GenerateCourseMapResult {
  courseMapId: string;
  mapMeta: CourseMapMeta;
  nodes: CourseMapNode[];
}

export interface CourseListItem {
  courseMapId: string;
  topic: string;
  level: string;
  mode: string;
  mapMeta: unknown;
  nodes: unknown;
  createdAt: string;
  progressPercentage: number;
}

export interface CourseMapDetail {
  courseMapId: string;
  topic: string;
  level: string;
  focus: string;
  verifiedConcept: string;
  mode: string;
  language: string;
  totalCommitmentMinutes: number;
  mapMeta: unknown;
  nodes: unknown;
  createdAt: string;
}

export interface NodeGenerationStatus {
  nodeId: number;
  status: string;
}

export interface GenerationProgressResult {
  courseMapId: string;
  overallStatus: 'pending' | 'generating' | 'completed' | 'partial';
  learnProgress: { total: number; completed: number; percentage: number };
  nodesStatus: NodeGenerationStatus[];
}

// ─── LLM 调用：生成课程 DAG ─────────────────────────────────────────────────

async function callLLMGenerateCourseMap(
  input: GenerateCourseMapInput,
): Promise<{ mapMeta: CourseMapMeta; nodes: CourseMapNode[] }> {
  console.log(
    `[courseMap.callLLM] Generating course map for topic="${input.topic}", level="${input.level}", mode="${input.mode}"`,
  );

  const systemPrompt = loadPrompt('dag');
  const userMessage = [
    '# User Input',
    `- language: zh`,
    `- topic: ${input.topic}`,
    `- level: ${input.level}`,
    `- focus: ${input.focus}`,
    `- verified_concept: ${input.verifiedConcept}`,
    `- mode: ${input.mode}`,
    `- total_commitment_minutes: ${input.totalCommitmentMinutes}`,
    input.interestedConcepts?.length
      ? `- interested_concepts: ${JSON.stringify(input.interestedConcepts)}`
      : '- interested_concepts: []',
  ].join('\n');

  const response = await completeLLM({
    promptName: 'dag',
    promptText: userMessage,
    outputFormat: 'json',
    systemMessage: systemPrompt,
  });

  const parsed = response.parsedData as Record<string, unknown> | null;
  if (!parsed || !parsed.nodes || !parsed.map_meta) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'LLM returned invalid DAG structure: missing nodes or map_meta',
    });
  }

  const rawNodes = parsed.nodes as Array<Record<string, unknown>>;
  const rawMeta = parsed.map_meta as Record<string, unknown>;

  // 将 LLM 返回的 snake_case 节点转为内部 CourseMapNode 格式
  const nodes: CourseMapNode[] = rawNodes.map((n) => ({
    id: n.id as number,
    title: n.title as string,
    description: n.description as string,
    type: n.type as string,
    estimated_minutes: n.estimated_minutes as number,
    pre_requisites: (n.pre_requisites as number[]) ?? [],
    layer: (n.layer as number) ?? 0,
  }));

  const mapMeta: CourseMapMeta = {
    totalNodes: nodes.length,
    totalMinutes: nodes.reduce((sum, n) => sum + n.estimated_minutes, 0),
    difficulty: input.level,
    course_name: rawMeta.course_name as string,
    strategy_rationale: rawMeta.strategy_rationale as string,
    mode: rawMeta.mode as string,
    time_budget_minutes: rawMeta.time_budget_minutes as number,
    time_sum_minutes: rawMeta.time_sum_minutes as number,
    time_delta_minutes: rawMeta.time_delta_minutes as number,
  };

  return { mapMeta, nodes };
}

// ─── 后台触发内容预生成 ─────────────────────────────────────────────────────

async function triggerContentPregeneration(
  db: Database,
  courseMapId: string,
  nodes: CourseMapNode[],
  courseInfo: { topic: string; level: string; mode: string; focus: string },
): Promise<void> {
  const learnNodes = nodes.filter((n) => n.type === 'learn');
  console.log(
    `[courseMap.pregenerate] Starting content generation: courseMapId=${courseMapId}, learnNodes=${learnNodes.length}`,
  );

  // 为每个 learn 节点创建 pending 记录
  for (const node of learnNodes) {
    await db
      .insert(nodeContents)
      .values({
        courseMapId,
        nodeId: node.id,
        contentType: 'knowledge_card',
        nodeType: node.type,
        contentJson: {},
        generationStatus: 'pending',
      })
      .onConflictDoNothing();
  }

  // 后台异步生成每个节点的知识卡片（不阻塞返回）
  generateAllNodeContents(db, courseMapId, learnNodes, courseInfo).catch((err) =>
    console.error(`[courseMap.pregenerate] Background generation failed: ${err}`),
  );
}

/**
 * 后台逐个生成所有 learn 节点的知识卡片。
 * 失败的节点标记为 failed，不影响其他节点。
 */
async function generateAllNodeContents(
  db: Database,
  courseMapId: string,
  nodes: CourseMapNode[],
  courseInfo: { topic: string; level: string; mode: string; focus: string },
): Promise<void> {
  const systemPrompt = loadPrompt('knowledge_card');

  for (const node of nodes) {
    try {
      // 标记为生成中
      await db
        .update(nodeContents)
        .set({ generationStatus: 'generating', generationStartedAt: new Date() })
        .where(
          and(
            eq(nodeContents.courseMapId, courseMapId),
            eq(nodeContents.nodeId, node.id),
            eq(nodeContents.contentType, 'knowledge_card'),
          ),
        );

      const userMessage = [
        `Language: zh`,
        `Course: ${courseInfo.topic}`,
        `Level: ${courseInfo.level}`,
        `Mode: ${courseInfo.mode}`,
        `Node Title: ${node.title}`,
        `Node Description: ${node.description}`,
        `Estimated Minutes: ${node.estimated_minutes}`,
      ].join('\n');

      const response = await completeLLM({
        promptName: 'knowledge_card',
        promptText: userMessage,
        outputFormat: 'json',
        systemMessage: systemPrompt,
      });

      const parsed = response.parsedData as Record<string, unknown>;
      const contentJson = {
        type: 'knowledge_card',
        nodeId: node.id,
        totalPagesInCard: (parsed.totalPagesInCard as number) ?? 1,
        markdown: (parsed.markdown as string) ?? '',
        yaml: (parsed.yaml as string) ?? '',
      };

      await db
        .update(nodeContents)
        .set({
          contentJson,
          generationStatus: 'completed',
          generationCompletedAt: new Date(),
        })
        .where(
          and(
            eq(nodeContents.courseMapId, courseMapId),
            eq(nodeContents.nodeId, node.id),
            eq(nodeContents.contentType, 'knowledge_card'),
          ),
        );

      console.log(`[pregenerate] Node ${node.id} (${node.title}) completed`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[pregenerate] Node ${node.id} (${node.title}) failed: ${errorMsg}`);

      await db
        .update(nodeContents)
        .set({
          generationStatus: 'failed',
          generationError: errorMsg.slice(0, 1000),
          generationCompletedAt: new Date(),
        })
        .where(
          and(
            eq(nodeContents.courseMapId, courseMapId),
            eq(nodeContents.nodeId, node.id),
            eq(nodeContents.contentType, 'knowledge_card'),
          ),
        );
    }
  }

  console.log(`[pregenerate] All nodes processed for courseMapId=${courseMapId}`);
}

// ─── 生成课程路径 DAG ────────────────────────────────────────────────────────

export async function generateCourseMap(
  db: Database,
  input: GenerateCourseMapInput,
  userId: string | null,
): Promise<GenerateCourseMapResult> {
  // 1. 调用 LLM 生成课程 DAG
  const { mapMeta, nodes } = await callLLMGenerateCourseMap(input);

  // 2. 保存到 course_maps 表
  const [courseMap] = await db
    .insert(courseMaps)
    .values({
      userId: userId ?? undefined,
      topic: input.topic,
      level: input.level as 'Novice' | 'Beginner' | 'Intermediate' | 'Advanced',
      focus: input.focus,
      verifiedConcept: input.verifiedConcept,
      mode: input.mode as 'Deep' | 'Fast' | 'Light',
      totalCommitmentMinutes: input.totalCommitmentMinutes,
      mapMeta: mapMeta as unknown as MapMetaJson,
      nodes: nodes as unknown as DAGNodeJson[],
    })
    .returning({ id: courseMaps.id });

  const courseMapId = courseMap.id;
  console.log(`[courseMap.generate] Created courseMapId=${courseMapId}, userId=${userId}, nodes=${nodes.length}`);

  // 3. 如果用户已登录，设为 active course 并创建节点进度
  if (userId) {
    await db
      .update(profiles)
      .set({ activeCourseMapId: courseMapId })
      .where(eq(profiles.id, userId));

    // 为所有节点创建初始进度：无前置依赖的设为 unlocked，其余 locked
    const noPrereqIds = new Set(
      nodes.filter((n) => !n.pre_requisites || n.pre_requisites.length === 0).map((n) => n.id),
    );

    for (const node of nodes) {
      const status = noPrereqIds.has(node.id) ? 'unlocked' : 'locked';
      await db
        .insert(nodeProgress)
        .values({ userId, courseMapId, nodeId: node.id, status })
        .onConflictDoNothing();
    }
  }

  // 4. 后台触发内容预生成
  await triggerContentPregeneration(db, courseMapId, nodes, {
    topic: input.topic,
    level: input.level,
    mode: input.mode,
    focus: input.focus,
  });

  return { courseMapId, mapMeta, nodes };
}

// ─── 获取用户所有课程列表 ─────────────────────────────────────────────────────

export async function listCourseMaps(
  db: Database,
  userId: string,
): Promise<{ courses: CourseListItem[] }> {
  const rows = await db
    .select({
      id: courseMaps.id,
      topic: courseMaps.topic,
      level: courseMaps.level,
      mode: courseMaps.mode,
      mapMeta: courseMaps.mapMeta,
      nodes: courseMaps.nodes,
      createdAt: courseMaps.createdAt,
    })
    .from(courseMaps)
    .where(eq(courseMaps.userId, userId))
    .orderBy(desc(courseMaps.createdAt));

  // 对每个课程计算进度百分比
  const courses: CourseListItem[] = [];
  for (const row of rows) {
    const nodes = row.nodes as CourseMapNode[] | null;
    const totalNodes = nodes?.length ?? 0;

    let completedNodes = 0;
    if (totalNodes > 0) {
      const progressRows = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(nodeProgress)
        .where(
          and(
            eq(nodeProgress.userId, userId),
            eq(nodeProgress.courseMapId, row.id),
            eq(nodeProgress.status, 'completed'),
          ),
        );
      completedNodes = progressRows[0]?.count ?? 0;
    }

    const progressPercentage = totalNodes > 0
      ? Math.round((completedNodes / totalNodes) * 100)
      : 0;

    courses.push({
      courseMapId: row.id,
      topic: row.topic,
      level: row.level,
      mode: row.mode,
      mapMeta: row.mapMeta,
      nodes: row.nodes,
      createdAt: row.createdAt.toISOString(),
      progressPercentage,
    });
  }

  console.log(`[courseMap.list] userId=${userId}, count=${courses.length}`);
  return { courses };
}

// ─── 获取课程详情 ─────────────────────────────────────────────────────────────

export async function getCourseMapDetail(
  db: Database,
  userId: string,
  courseMapId: string,
): Promise<CourseMapDetail | null> {
  const rows = await db
    .select({
      id: courseMaps.id,
      topic: courseMaps.topic,
      level: courseMaps.level,
      focus: courseMaps.focus,
      verifiedConcept: courseMaps.verifiedConcept,
      mode: courseMaps.mode,
      language: courseMaps.language,
      totalCommitmentMinutes: courseMaps.totalCommitmentMinutes,
      mapMeta: courseMaps.mapMeta,
      nodes: courseMaps.nodes,
      createdAt: courseMaps.createdAt,
      courseUserId: courseMaps.userId,
    })
    .from(courseMaps)
    .where(
      and(
        eq(courseMaps.id, courseMapId),
        eq(courseMaps.userId, userId),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    courseMapId: row.id,
    topic: row.topic,
    level: row.level,
    focus: row.focus,
    verifiedConcept: row.verifiedConcept,
    mode: row.mode,
    language: row.language,
    totalCommitmentMinutes: row.totalCommitmentMinutes,
    mapMeta: row.mapMeta,
    nodes: row.nodes,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── 获取内容生成进度 ─────────────────────────────────────────────────────────

export async function getGenerationProgress(
  db: Database,
  userId: string,
  courseMapId: string,
): Promise<GenerationProgressResult | null> {
  // 先验证课程归属
  const courseRows = await db
    .select({ id: courseMaps.id, nodes: courseMaps.nodes })
    .from(courseMaps)
    .where(and(eq(courseMaps.id, courseMapId), eq(courseMaps.userId, userId)))
    .limit(1);

  if (courseRows.length === 0) return null;

  const nodes = courseRows[0].nodes as CourseMapNode[] | null;
  const nodeIds = (nodes ?? []).map((n) => n.id);

  // 查询 node_contents 的生成状态
  const contentRows = await db
    .select({
      nodeId: nodeContents.nodeId,
      generationStatus: nodeContents.generationStatus,
      contentType: nodeContents.contentType,
    })
    .from(nodeContents)
    .where(eq(nodeContents.courseMapId, courseMapId));

  // 按 nodeId 聚合（取 knowledge_card 类型的状态）
  const nodeStatusMap = new Map<number, string>();
  for (const row of contentRows) {
    if (row.contentType === 'knowledge_card') {
      nodeStatusMap.set(row.nodeId, row.generationStatus);
    }
  }

  const nodesStatus: NodeGenerationStatus[] = nodeIds.map((nid) => ({
    nodeId: nid,
    status: nodeStatusMap.get(nid) ?? 'pending',
  }));

  const totalLearnNodes = nodeIds.length;
  const completedLearnNodes = nodesStatus.filter((n) => n.status === 'completed').length;
  const generatingNodes = nodesStatus.filter((n) => n.status === 'generating').length;

  let overallStatus: GenerationProgressResult['overallStatus'];
  if (completedLearnNodes === totalLearnNodes && totalLearnNodes > 0) {
    overallStatus = 'completed';
  } else if (generatingNodes > 0) {
    overallStatus = 'generating';
  } else if (completedLearnNodes > 0) {
    overallStatus = 'partial';
  } else {
    overallStatus = 'pending';
  }

  // 查询学习进度（node_progress）
  const progressRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(nodeProgress)
    .where(
      and(
        eq(nodeProgress.userId, userId),
        eq(nodeProgress.courseMapId, courseMapId),
        eq(nodeProgress.status, 'completed'),
      ),
    );
  const completedProgress = progressRows[0]?.count ?? 0;

  console.log(`[courseMap.generationProgress] courseMapId=${courseMapId}, overall=${overallStatus}, content=${completedLearnNodes}/${totalLearnNodes}`);

  return {
    courseMapId,
    overallStatus,
    learnProgress: {
      total: totalLearnNodes,
      completed: completedProgress,
      percentage: totalLearnNodes > 0
        ? Math.round((completedProgress / totalLearnNodes) * 100)
        : 0,
    },
    nodesStatus,
  };
}
