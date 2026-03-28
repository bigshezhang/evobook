import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type { Database } from '../../db';
import { nodeContents } from '../../db/schema';
import { completeLLM } from '../../lib/llm';
import { loadPrompt } from '../../lib/prompts';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface CourseContext {
  courseName: string;
  courseContext: string;
  topic: string;
  level: string;
  mode: string;
}

export interface NodeInfo {
  id: number;
  title: string;
  description: string;
  type: string;
  estimatedMinutes: number;
}

export interface GetKnowledgeCardInput {
  language: string;
  courseMapId: string;
  course: CourseContext;
  node: NodeInfo;
}

export interface KnowledgeCardResult {
  type: 'knowledge_card';
  nodeId: number;
  totalPagesInCard: number;
  markdown: string;
  yaml: string;
}

export interface GetClarificationInput {
  language: string;
  userQuestionRaw: string;
  pageMarkdown: string;
  courseMapId?: string;
  nodeId?: number;
}

export interface ClarificationResult {
  type: 'clarification';
  correctedTitle: string;
  shortAnswer: string;
}

export interface GetQADetailInput {
  language: string;
  qaTitle: string;
  qaShortAnswer: string;
  courseMapId?: string;
  nodeId?: number;
}

export interface QADetailResult {
  type: 'qa_detail';
  title: string;
  bodyMarkdown: string;
  image: { placeholder: string; prompt: string };
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/** 对文本生成短 hash，用于 question 缓存键 */
function computeQuestionKey(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// ─── LLM 调用：知识卡片 ─────────────────────────────────────────────────────

async function callLLMKnowledgeCard(
  input: GetKnowledgeCardInput,
): Promise<{ totalPagesInCard: number; markdown: string; yaml: string }> {
  console.log(
    `[nodeContent.callLLM] Generating knowledge card for node="${input.node.title}", courseMapId=${input.courseMapId}`,
  );

  const systemPrompt = loadPrompt('knowledge_card');
  const userMessage = [
    '# Input',
    `- language: ${input.language}`,
    `- course_name: ${input.course.courseName}`,
    `- course_context: ${input.course.courseContext}`,
    `- topic: ${input.course.topic}`,
    `- level: ${input.course.level}`,
    `- mode: ${input.course.mode}`,
    `- node:`,
    `    id: ${input.node.id}`,
    `    title: ${input.node.title}`,
    `    description: ${input.node.description}`,
    `    type: ${input.node.type}`,
    `    estimated_minutes: ${input.node.estimatedMinutes}`,
  ].join('\n');

  const response = await completeLLM({
    promptName: 'knowledge_card',
    promptText: userMessage,
    outputFormat: 'json',
    systemMessage: systemPrompt,
  });

  const parsed = response.parsedData as Record<string, unknown> | null;
  if (!parsed || typeof parsed.markdown !== 'string') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'LLM returned invalid knowledge card: missing markdown field',
    });
  }

  return {
    totalPagesInCard: (parsed.totalPagesInCard as number) ?? 1,
    markdown: parsed.markdown as string,
    yaml: (parsed.yaml as string) ?? '',
  };
}

// ─── LLM 调用：澄清回答 ─────────────────────────────────────────────────────

async function callLLMClarification(
  input: GetClarificationInput,
): Promise<{ correctedTitle: string; shortAnswer: string }> {
  console.log(
    `[nodeContent.callLLM] Generating clarification for question="${input.userQuestionRaw.slice(0, 50)}..."`,
  );

  const systemPrompt = loadPrompt('clarification');
  const userMessage = [
    '# Input',
    `- language: ${input.language}`,
    `- user_question_raw: ${input.userQuestionRaw}`,
    `- page_markdown:`,
    input.pageMarkdown,
  ].join('\n');

  const response = await completeLLM({
    promptName: 'clarification',
    promptText: userMessage,
    outputFormat: 'json',
    systemMessage: systemPrompt,
  });

  const parsed = response.parsedData as Record<string, unknown> | null;
  if (!parsed || typeof parsed.corrected_title !== 'string') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'LLM returned invalid clarification: missing corrected_title',
    });
  }

  return {
    correctedTitle: parsed.corrected_title as string,
    shortAnswer: (parsed.short_answer as string) ?? '',
  };
}

// ─── LLM 调用：QA 详情 ──────────────────────────────────────────────────────

async function callLLMQADetail(
  input: GetQADetailInput,
): Promise<{
  title: string;
  bodyMarkdown: string;
  image: { placeholder: string; prompt: string };
}> {
  console.log(`[nodeContent.callLLM] Generating QA detail for title="${input.qaTitle}"`);

  const systemPrompt = loadPrompt('qa_detail');
  const userMessage = [
    '# Input',
    `- language: ${input.language}`,
    `- qa_title: ${input.qaTitle}`,
    `- qa_short_answer: ${input.qaShortAnswer}`,
  ].join('\n');

  const response = await completeLLM({
    promptName: 'qa_detail',
    promptText: userMessage,
    outputFormat: 'json',
    systemMessage: systemPrompt,
  });

  const parsed = response.parsedData as Record<string, unknown> | null;
  if (!parsed || typeof parsed.title !== 'string') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'LLM returned invalid QA detail: missing title field',
    });
  }

  const image = (parsed.image as { placeholder?: string; prompt?: string }) ?? {};
  return {
    title: parsed.title as string,
    bodyMarkdown: (parsed.body_markdown as string) ?? '',
    image: {
      placeholder: image.placeholder ?? '',
      prompt: image.prompt ?? '',
    },
  };
}

// ─── 生成知识卡片 ─────────────────────────────────────────────────────────────

export async function getKnowledgeCard(
  db: Database,
  input: GetKnowledgeCardInput,
): Promise<KnowledgeCardResult> {
  // 1. 查缓存：检查 node_contents 表是否已有完成的记录
  const cachedRows = await db
    .select({
      contentJson: nodeContents.contentJson,
      generationStatus: nodeContents.generationStatus,
    })
    .from(nodeContents)
    .where(
      and(
        eq(nodeContents.courseMapId, input.courseMapId),
        eq(nodeContents.nodeId, input.node.id),
        eq(nodeContents.contentType, 'knowledge_card'),
      ),
    )
    .limit(1);

  if (cachedRows.length > 0 && cachedRows[0].generationStatus === 'completed') {
    const cached = cachedRows[0].contentJson as Record<string, unknown>;
    console.log(`[nodeContent.knowledgeCard] Cache hit: courseMapId=${input.courseMapId}, nodeId=${input.node.id}`);
    return {
      type: 'knowledge_card',
      nodeId: input.node.id,
      totalPagesInCard: (cached.totalPagesInCard as number) ?? 1,
      markdown: (cached.markdown as string) ?? '',
      yaml: (cached.yaml as string) ?? '',
    };
  }

  // 2. 标记为生成中
  let existingId: string | null = null;
  if (cachedRows.length > 0) {
    // 更新已有记录状态
    const updateRows = await db
      .select({ id: nodeContents.id })
      .from(nodeContents)
      .where(
        and(
          eq(nodeContents.courseMapId, input.courseMapId),
          eq(nodeContents.nodeId, input.node.id),
          eq(nodeContents.contentType, 'knowledge_card'),
        ),
      )
      .limit(1);
    if (updateRows.length > 0) {
      existingId = updateRows[0].id;
      await db
        .update(nodeContents)
        .set({ generationStatus: 'generating', generationStartedAt: new Date() })
        .where(eq(nodeContents.id, existingId));
    }
  }

  // 3. 调用 LLM
  try {
    const llmResult = await callLLMKnowledgeCard(input);

    const contentJson = {
      totalPagesInCard: llmResult.totalPagesInCard,
      markdown: llmResult.markdown,
      yaml: llmResult.yaml,
    };

    // 4. 保存或更新到 node_contents
    if (existingId) {
      await db
        .update(nodeContents)
        .set({
          contentJson,
          generationStatus: 'completed',
          generationCompletedAt: new Date(),
          generationError: null,
        })
        .where(eq(nodeContents.id, existingId));
    } else {
      await db.insert(nodeContents).values({
        courseMapId: input.courseMapId,
        nodeId: input.node.id,
        contentType: 'knowledge_card',
        nodeType: input.node.type,
        contentJson,
        generationStatus: 'completed',
        generationStartedAt: new Date(),
        generationCompletedAt: new Date(),
      });
    }

    console.log(`[nodeContent.knowledgeCard] Generated: courseMapId=${input.courseMapId}, nodeId=${input.node.id}`);

    return {
      type: 'knowledge_card',
      nodeId: input.node.id,
      totalPagesInCard: llmResult.totalPagesInCard,
      markdown: llmResult.markdown,
      yaml: llmResult.yaml,
    };
  } catch (err) {
    // 标记生成失败
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    if (existingId) {
      await db
        .update(nodeContents)
        .set({ generationStatus: 'failed', generationError: errorMessage })
        .where(eq(nodeContents.id, existingId));
    }
    throw err;
  }
}

// ─── 生成澄清回答 ────────────────────────────────────────────────────────────

export async function getClarification(
  db: Database,
  input: GetClarificationInput,
): Promise<ClarificationResult> {
  const questionKey = computeQuestionKey(input.userQuestionRaw);

  // 1. 查缓存（按 courseMapId + nodeId + contentType + questionKey）
  if (input.courseMapId && input.nodeId != null) {
    const cachedRows = await db
      .select({ contentJson: nodeContents.contentJson })
      .from(nodeContents)
      .where(
        and(
          eq(nodeContents.courseMapId, input.courseMapId),
          eq(nodeContents.nodeId, input.nodeId),
          eq(nodeContents.contentType, 'clarification'),
          eq(nodeContents.questionKey, questionKey),
        ),
      )
      .limit(1);

    if (cachedRows.length > 0) {
      const cached = cachedRows[0].contentJson as Record<string, unknown>;
      console.log(`[nodeContent.clarification] Cache hit: questionKey=${questionKey}`);
      return {
        type: 'clarification',
        correctedTitle: (cached.correctedTitle as string) ?? '',
        shortAnswer: (cached.shortAnswer as string) ?? '',
      };
    }
  }

  // 2. 调用 LLM
  const llmResult = await callLLMClarification(input);

  // 3. 保存到缓存（仅当有 courseMapId 和 nodeId 时）
  if (input.courseMapId && input.nodeId != null) {
    await db.insert(nodeContents).values({
      courseMapId: input.courseMapId,
      nodeId: input.nodeId,
      contentType: 'clarification',
      questionKey,
      contentJson: {
        correctedTitle: llmResult.correctedTitle,
        shortAnswer: llmResult.shortAnswer,
        originalQuestion: input.userQuestionRaw,
      },
      generationStatus: 'completed',
      generationStartedAt: new Date(),
      generationCompletedAt: new Date(),
    });
  }

  console.log(`[nodeContent.clarification] Generated: questionKey=${questionKey}, courseMapId=${input.courseMapId}`);

  return {
    type: 'clarification',
    correctedTitle: llmResult.correctedTitle,
    shortAnswer: llmResult.shortAnswer,
  };
}

// ─── 生成详细 QA ──────────────────────────────────────────────────────────────

export async function getQADetail(
  db: Database,
  input: GetQADetailInput,
): Promise<QADetailResult> {
  const questionKey = computeQuestionKey(input.qaTitle);

  // 1. 查缓存
  if (input.courseMapId && input.nodeId != null) {
    const cachedRows = await db
      .select({ contentJson: nodeContents.contentJson })
      .from(nodeContents)
      .where(
        and(
          eq(nodeContents.courseMapId, input.courseMapId),
          eq(nodeContents.nodeId, input.nodeId),
          eq(nodeContents.contentType, 'qa_detail'),
          eq(nodeContents.questionKey, questionKey),
        ),
      )
      .limit(1);

    if (cachedRows.length > 0) {
      const cached = cachedRows[0].contentJson as Record<string, unknown>;
      console.log(`[nodeContent.qaDetail] Cache hit: questionKey=${questionKey}`);
      return {
        type: 'qa_detail',
        title: (cached.title as string) ?? '',
        bodyMarkdown: (cached.bodyMarkdown as string) ?? '',
        image: (cached.image as { placeholder: string; prompt: string }) ?? { placeholder: '', prompt: '' },
      };
    }
  }

  // 2. 调用 LLM
  const llmResult = await callLLMQADetail(input);

  // 3. 保存到缓存
  if (input.courseMapId && input.nodeId != null) {
    await db.insert(nodeContents).values({
      courseMapId: input.courseMapId,
      nodeId: input.nodeId,
      contentType: 'qa_detail',
      questionKey,
      contentJson: {
        title: llmResult.title,
        bodyMarkdown: llmResult.bodyMarkdown,
        image: llmResult.image,
      },
      generationStatus: 'completed',
      generationStartedAt: new Date(),
      generationCompletedAt: new Date(),
    });
  }

  console.log(`[nodeContent.qaDetail] Generated: questionKey=${questionKey}, courseMapId=${input.courseMapId}`);

  return {
    type: 'qa_detail',
    title: llmResult.title,
    bodyMarkdown: llmResult.bodyMarkdown,
    image: llmResult.image,
  };
}
