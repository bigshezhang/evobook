import { eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { onboardingSessions, profiles } from '../../db/schema';
import { completeLLM } from '../../lib/llm';
import { loadPrompt } from '../../lib/prompts';

// ─── 常量 ───────────────────────────────────────────────────────────────────

/** onboarding 阶段顺序 */
const PHASE_ORDER = [
  'exploration',
  'calibration_r1',
  'calibration_r2',
  'focus',
  'mode',
  'source',
  'handoff',
] as const;

type Phase = (typeof PHASE_ORDER)[number];

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface OnboardingNextInput {
  sessionId?: string;
  userMessage?: string;
  userChoice?: string;
  initialTopic?: string;
  discoveryPresetId?: string;
}

/** 继续对话 */
interface ChatResponse {
  type: 'chat';
  message: string;
  options?: string[];
  sessionId: string;
}

/** 完成 onboarding */
interface FinishResponse {
  type: 'finish';
  message: string;
  data: {
    topic: string;
    level: string;
    verifiedConcept: string;
    focus: string;
    source: string;
    mode: string;
    intent: string;
  };
  sessionId: string;
}

/** 概念列表确认 */
interface ConceptListCheckResponse {
  type: 'concept_list_check';
  message: string;
  concepts: string[];
  sessionId: string;
}

export type OnboardingResponse =
  | ChatResponse
  | FinishResponse
  | ConceptListCheckResponse;

// ─── MOCK_LLM 开关 ──────────────────────────────────────────────────────────

const USE_MOCK_LLM = process.env.MOCK_LLM === 'true';

// ─── Mock 实现（MOCK_LLM=true 时使用） ──────────────────────────────────────

function callLLMMock(
  phase: string,
  context: Record<string, unknown>,
): {
  message: string;
  options?: string[];
  concepts?: string[];
  data?: Record<string, unknown>;
} {
  if (phase === 'calibration_r2') {
    return {
      message: `[Mock] Please verify these concepts for your topic`,
      concepts: ['Concept A', 'Concept B', 'Concept C'],
    };
  }
  if (phase === 'handoff') {
    return {
      message: `[Mock] Onboarding complete! Let's start learning.`,
      data: {
        topic: (context.topic as string) || 'General Topic',
        level: (context.level as string) || 'Beginner',
        verifiedConcept: (context.verifiedConcept as string) || 'Core Concept',
        focus: (context.focus as string) || 'theory',
        source: (context.source as string) || 'self',
        mode: (context.mode as string) || 'Deep',
        intent: 'learn',
      },
    };
  }
  return {
    message: `[Mock] Phase ${phase} response`,
    options: ['Option A', 'Option B', 'Option C'],
  };
}

// ─── LLM 调用 ───────────────────────────────────────────────────────────────

async function callLLM(
  phase: string,
  context: Record<string, unknown>,
): Promise<{
  message: string;
  options?: string[];
  concepts?: string[];
  data?: Record<string, unknown>;
}> {
  console.log(`[onboarding.callLLM] phase=${phase}, mock=${USE_MOCK_LLM}, context keys=${Object.keys(context).join(',')}`);

  if (USE_MOCK_LLM) {
    return callLLMMock(phase, context);
  }

  // 真实 LLM 调用：prompt 模板作为 system，上下文数据作为 user 消息
  const systemPrompt = loadPrompt('onboarding');
  const userMessage = [
    '# Current Context',
    `- Phase: ${phase}`,
    `- Language: ${(context.language as string) ?? 'zh'}`,
    `- Topic: ${(context.topic as string) ?? 'Not set'}`,
    `- Level: ${(context.level as string) ?? 'Not set'}`,
    `- Verified Concept: ${(context.verifiedConcept as string) ?? 'Not set'}`,
    `- Focus: ${(context.focus as string) ?? 'Not set'}`,
    `- Mode: ${(context.mode as string) ?? 'Not set'}`,
    `- Source: ${(context.source as string) ?? 'Not set'}`,
    `- Returning user (skip source question): ${(context.isReturning as boolean) ? 'true' : 'false'}`,
    '',
    '# User Input',
    context.userChoice ? `User selected option: ${context.userChoice}` : '',
    context.userMessage ? `User message: ${context.userMessage}` : '',
    context.interestedConcepts
      ? `Interested concepts: ${JSON.stringify(context.interestedConcepts)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await completeLLM({
    promptName: 'onboarding',
    promptText: userMessage,
    outputFormat: 'json',
    systemMessage: systemPrompt,
  });

  // 解析 LLM 返回的 JSON
  const parsed = response.parsedData as Record<string, unknown>;
  return {
    message: (parsed.message as string) ?? '',
    options: (parsed.options as string[]) ?? undefined,
    concepts: (parsed.concepts as string[]) ?? undefined,
    data: (parsed.data as Record<string, unknown>) ?? undefined,
  };
}

// ─── 核心逻辑 ─────────────────────────────────────────────────────────────────

/** 获取下一阶段 */
function getNextPhase(current: string): Phase | null {
  const idx = PHASE_ORDER.indexOf(current as Phase);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

/**
 * 处理 onboarding 的一次交互。
 * 每次调用根据当前 phase 调用 LLM，更新 session 状态，并返回响应。
 */
export async function processOnboardingNext(
  db: Database,
  input: OnboardingNextInput,
  userId: string | null,
): Promise<OnboardingResponse> {
  // 1. 获取或创建 session
  let sessionId = input.sessionId;
  let session: {
    id: string;
    phase: string;
    topic: string | null;
    level: string | null;
    verifiedConcept: string | null;
    focus: string | null;
    mode: string | null;
    source: string | null;
    intent: string | null;
    stateJson: unknown;
  };

  if (sessionId) {
    const rows = await db
      .select({
        id: onboardingSessions.id,
        phase: onboardingSessions.phase,
        topic: onboardingSessions.topic,
        level: onboardingSessions.level,
        verifiedConcept: onboardingSessions.verifiedConcept,
        focus: onboardingSessions.focus,
        mode: onboardingSessions.mode,
        source: onboardingSessions.source,
        intent: onboardingSessions.intent,
        stateJson: onboardingSessions.stateJson,
      })
      .from(onboardingSessions)
      .where(eq(onboardingSessions.id, sessionId))
      .limit(1);

    if (rows.length === 0) {
      throw new Error(`Onboarding session '${sessionId}' not found`);
    }
    session = rows[0];
  } else {
    // 创建新 session
    const [newSession] = await db
      .insert(onboardingSessions)
      .values({
        userId: userId ?? undefined,
        phase: 'exploration',
        topic: input.initialTopic ?? null,
        stateJson: {
          initialTopic: input.initialTopic ?? null,
          discoveryPresetId: input.discoveryPresetId ?? null,
        },
      })
      .returning({
        id: onboardingSessions.id,
        phase: onboardingSessions.phase,
        topic: onboardingSessions.topic,
        level: onboardingSessions.level,
        verifiedConcept: onboardingSessions.verifiedConcept,
        focus: onboardingSessions.focus,
        mode: onboardingSessions.mode,
        source: onboardingSessions.source,
        intent: onboardingSessions.intent,
        stateJson: onboardingSessions.stateJson,
      });

    session = newSession;
    sessionId = newSession.id;
    console.log(`[onboarding.next] Created new session: ${sessionId}, userId=${userId}`);
  }

  const currentPhase = session.phase;
  const stateJson = (session.stateJson as Record<string, unknown>) ?? {};

  // 2. 构建 LLM 上下文
  const llmContext: Record<string, unknown> = {
    ...stateJson,
    topic: session.topic,
    level: session.level,
    verifiedConcept: session.verifiedConcept,
    focus: session.focus,
    mode: session.mode,
    source: session.source,
    userMessage: input.userMessage,
    userChoice: input.userChoice,
  };

  // 3. 调用 LLM
  const llmResult = await callLLM(currentPhase, llmContext);

  // 4. 根据 LLM 结果构建更新和响应
  const updateFields: Record<string, unknown> = {};

  // 根据阶段提取 LLM 返回的关键信息，写入 session 字段
  if (input.userChoice || input.userMessage) {
    const newState = { ...stateJson, [`${currentPhase}_response`]: input.userChoice ?? input.userMessage };
    updateFields.stateJson = newState;
  }

  // 5. 根据当前阶段决定响应类型
  if (currentPhase === 'handoff' && llmResult.data) {
    // 完成 onboarding
    const data = llmResult.data as Record<string, string>;
    updateFields.topic = data.topic;
    updateFields.level = data.level;
    updateFields.verifiedConcept = data.verifiedConcept;
    updateFields.focus = data.focus;
    updateFields.mode = data.mode;
    updateFields.source = data.source;
    updateFields.intent = data.intent;
    updateFields.phase = 'completed';

    await db
      .update(onboardingSessions)
      .set(updateFields)
      .where(eq(onboardingSessions.id, sessionId));

    // 标记用户 onboarding 完成
    if (userId) {
      await db
        .update(profiles)
        .set({ onboardingCompleted: true })
        .where(eq(profiles.id, userId));
    }

    console.log(`[onboarding.next] Session ${sessionId} completed handoff`);

    return {
      type: 'finish',
      message: llmResult.message,
      data: {
        topic: data.topic,
        level: data.level,
        verifiedConcept: data.verifiedConcept,
        focus: data.focus,
        source: data.source,
        mode: data.mode,
        intent: data.intent,
      },
      sessionId,
    };
  }

  if (llmResult.concepts && llmResult.concepts.length > 0) {
    // 概念确认阶段
    const newState = {
      ...(updateFields.stateJson as Record<string, unknown> ?? stateJson),
      pendingConcepts: llmResult.concepts,
    };
    updateFields.stateJson = newState;

    await db
      .update(onboardingSessions)
      .set(updateFields)
      .where(eq(onboardingSessions.id, sessionId));

    console.log(`[onboarding.next] Session ${sessionId} concept_list_check, concepts=${llmResult.concepts.length}`);

    return {
      type: 'concept_list_check',
      message: llmResult.message,
      concepts: llmResult.concepts,
      sessionId,
    };
  }

  // 普通对话：推进到下一阶段
  const nextPhase = getNextPhase(currentPhase);
  if (nextPhase) {
    updateFields.phase = nextPhase;
  }

  await db
    .update(onboardingSessions)
    .set(updateFields)
    .where(eq(onboardingSessions.id, sessionId));

  console.log(`[onboarding.next] Session ${sessionId} phase ${currentPhase} -> ${nextPhase ?? currentPhase}`);

  return {
    type: 'chat',
    message: llmResult.message,
    options: llmResult.options,
    sessionId,
  };
}
