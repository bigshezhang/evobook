import { eq, and, desc, isNull } from 'drizzle-orm';
import { quizAttempts } from '../../db/schema';
import type { QuizJson } from '../../db/schema';
import type { Database } from '../../db';
import { completeLLM } from '../../lib/llm';
import { loadPrompt } from '../../lib/prompts';

export interface QuizAttemptRow {
  id: string;
  courseMapId: string;
  nodeId: number;
  quizJson: QuizJson;
  score: number | null;
  createdAt: string;
}

function toAttemptRow(row: {
  id: string;
  courseMapId: string;
  nodeId: number;
  quizJson: QuizJson;
  score: number | null;
  createdAt: Date;
}): QuizAttemptRow {
  return {
    id: row.id,
    courseMapId: row.courseMapId,
    nodeId: row.nodeId,
    quizJson: row.quizJson,
    score: row.score,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── 保存草稿（upsert：找到已有 score=null 的记录则更新，否则创建）─────────

export async function saveDraft(
  db: Database,
  userId: string,
  courseMapId: string,
  nodeId: number,
  quizJson: unknown,
): Promise<QuizAttemptRow> {
  // 查找已有草稿（score 为 null）
  const [existing] = await db
    .select()
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.userId, userId),
        eq(quizAttempts.courseMapId, courseMapId),
        eq(quizAttempts.nodeId, nodeId),
        isNull(quizAttempts.score),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(quizAttempts)
      .set({ quizJson: quizJson as QuizJson })
      .where(eq(quizAttempts.id, existing.id))
      .returning({
        id: quizAttempts.id,
        courseMapId: quizAttempts.courseMapId,
        nodeId: quizAttempts.nodeId,
        quizJson: quizAttempts.quizJson,
        score: quizAttempts.score,
        createdAt: quizAttempts.createdAt,
      });
    return toAttemptRow(updated);
  }

  // 创建新草稿
  const [created] = await db
    .insert(quizAttempts)
    .values({ userId, courseMapId, nodeId, quizJson: quizJson as QuizJson })
    .returning({
      id: quizAttempts.id,
      courseMapId: quizAttempts.courseMapId,
      nodeId: quizAttempts.nodeId,
      quizJson: quizAttempts.quizJson,
      score: quizAttempts.score,
      createdAt: quizAttempts.createdAt,
    });
  return toAttemptRow(created);
}

// ─── 获取草稿（score = null 的记录）─────────────────────────────────────────

export async function getDraft(
  db: Database,
  userId: string,
  courseMapId: string,
  nodeId: number,
): Promise<QuizAttemptRow | null> {
  const [row] = await db
    .select({
      id: quizAttempts.id,
      courseMapId: quizAttempts.courseMapId,
      nodeId: quizAttempts.nodeId,
      quizJson: quizAttempts.quizJson,
      score: quizAttempts.score,
      createdAt: quizAttempts.createdAt,
    })
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.userId, userId),
        eq(quizAttempts.courseMapId, courseMapId),
        eq(quizAttempts.nodeId, nodeId),
        isNull(quizAttempts.score),
      ),
    )
    .limit(1);

  return row ? toAttemptRow(row) : null;
}

// ─── 提交 quiz ──────────────────────────────────────────────────────────────

export async function submitQuiz(
  db: Database,
  userId: string,
  courseMapId: string,
  nodeId: number,
  quizJson: unknown,
  score: number,
  attemptId?: string,
): Promise<QuizAttemptRow> {
  // 如果提供 attemptId，更新已有记录
  if (attemptId) {
    const [existing] = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.id, attemptId),
          eq(quizAttempts.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(quizAttempts)
        .set({ quizJson: quizJson as QuizJson, score })
        .where(eq(quizAttempts.id, attemptId))
        .returning({
          id: quizAttempts.id,
          courseMapId: quizAttempts.courseMapId,
          nodeId: quizAttempts.nodeId,
          quizJson: quizAttempts.quizJson,
          score: quizAttempts.score,
          createdAt: quizAttempts.createdAt,
        });
      return toAttemptRow(updated);
    }
  }

  // 创建新提交记录
  const [created] = await db
    .insert(quizAttempts)
    .values({ userId, courseMapId, nodeId, quizJson: quizJson as QuizJson, score })
    .returning({
      id: quizAttempts.id,
      courseMapId: quizAttempts.courseMapId,
      nodeId: quizAttempts.nodeId,
      quizJson: quizAttempts.quizJson,
      score: quizAttempts.score,
      createdAt: quizAttempts.createdAt,
    });
  return toAttemptRow(created);
}

// ─── 获取 quiz 历史（按 createdAt 降序）────────────────────────────────────

export async function getHistory(
  db: Database,
  userId: string,
  courseMapId: string,
  nodeId: number,
): Promise<QuizAttemptRow[]> {
  const rows = await db
    .select({
      id: quizAttempts.id,
      courseMapId: quizAttempts.courseMapId,
      nodeId: quizAttempts.nodeId,
      quizJson: quizAttempts.quizJson,
      score: quizAttempts.score,
      createdAt: quizAttempts.createdAt,
    })
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.userId, userId),
        eq(quizAttempts.courseMapId, courseMapId),
        eq(quizAttempts.nodeId, nodeId),
      ),
    )
    .orderBy(desc(quizAttempts.createdAt));

  return rows.map(toAttemptRow);
}

// ─── 获取单条 quiz attempt 详情 ─────────────────────────────────────────────

export async function getAttemptDetail(
  db: Database,
  userId: string,
  attemptId: string,
): Promise<QuizAttemptRow | null> {
  const [row] = await db
    .select({
      id: quizAttempts.id,
      courseMapId: quizAttempts.courseMapId,
      nodeId: quizAttempts.nodeId,
      quizJson: quizAttempts.quizJson,
      score: quizAttempts.score,
      createdAt: quizAttempts.createdAt,
    })
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.id, attemptId),
        eq(quizAttempts.userId, userId),
      ),
    )
    .limit(1);

  return row ? toAttemptRow(row) : null;
}

// ─── Quiz 生成（LLM） ───────────────────────────────────────────────────────

export interface GenerateQuizInput {
  language: string;
  mode: string;
  learnedTopics: Array<{ topicName: string; pagesMarkdown: string }>;
}

export async function generateQuiz(input: GenerateQuizInput): Promise<{
  type: string;
  title: string;
  greeting?: { topicsIncluded: string[]; message: string };
  questions: Array<Record<string, unknown>>;
}> {
  const systemPrompt = loadPrompt('quiz');
  const userMessage = [
    `Language: ${input.language}`,
    `Mode: ${input.mode}`,
    'Learned Topics:',
    ...input.learnedTopics.map(
      (t, i) => `--- Topic ${i + 1}: ${t.topicName} ---\n${t.pagesMarkdown}`,
    ),
  ].join('\n\n');

  const response = await completeLLM({
    promptName: 'quiz',
    promptText: userMessage,
    outputFormat: 'json',
    systemMessage: systemPrompt,
  });

  const parsed = response.parsedData as Record<string, unknown>;
  return {
    type: 'quiz',
    title: (parsed.title as string) ?? 'Quiz',
    greeting: parsed.greeting as { topicsIncluded: string[]; message: string } | undefined,
    questions: (parsed.questions as Array<Record<string, unknown>>) ?? [],
  };
}
