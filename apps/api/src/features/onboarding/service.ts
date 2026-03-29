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

  const jsonInstruction = `\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no extra text. Format:
{"message": "your response text", "options": ["option1", "option2", "option3"]}
For concept_list_check phase: {"message": "text", "concepts": ["concept1", "concept2"]}
For handoff phase: {"message": "text", "data": {"topic": "...", "level": "...", "verifiedConcept": "...", "focus": "...", "source": "...", "mode": "...", "intent": "learn"}}`;

  const response = await completeLLM({
    promptName: 'onboarding',
    promptText: userMessage,
    outputFormat: 'json',
    systemMessage: systemPrompt + jsonInstruction,
  });

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
        userId: userId ?? null,
        phase: 'exploration',
        topic: input.initialTopic ?? null,
        level: null,
        verifiedConcept: null,
        focus: null,
        mode: null,
        source: null,
        intent: null,
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

  // 5. 如果当前 phase 是 handoff，强制完成（不再循环）
  if (currentPhase === 'handoff') {
    const llmData = (llmResult.data ?? {}) as Record<string, string>;
    const finishData = {
      topic: llmData.topic || (session.topic as string) || 'General Topic',
      level: llmData.level || (session.level as string) || 'Beginner',
      verifiedConcept: llmData.verifiedConcept || (session.verifiedConcept as string) || (session.topic as string) || 'Core Concept',
      focus: llmData.focus || (session.focus as string) || 'theory',
      source: llmData.source || (session.source as string) || 'self',
      mode: llmData.mode || (session.mode as string) || 'Fast',
      intent: llmData.intent || 'learn',
    };

    const validLevels2 = ['Novice', 'Beginner', 'Intermediate', 'Advanced'];
    const validModes2 = ['Deep', 'Fast', 'Light'];

    await db
      .update(onboardingSessions)
      .set({
        phase: 'completed' as const,
        topic: finishData.topic,
        level: (validLevels2.includes(finishData.level) ? finishData.level : 'Beginner') as 'Beginner',
        verifiedConcept: finishData.verifiedConcept,
        focus: finishData.focus,
        mode: (validModes2.includes(finishData.mode) ? finishData.mode : 'Fast') as 'Fast',
        source: finishData.source,
        intent: finishData.intent,
      })
      .where(eq(onboardingSessions.id, sessionId));

    if (userId) {
      await db
        .update(profiles)
        .set({ onboardingCompleted: true })
        .where(eq(profiles.id, userId));
    }

    console.log(`[onboarding.next] Session ${sessionId} completed handoff with data:`, finishData);

    return {
      type: 'finish',
      message: llmResult.message,
      data: finishData,
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

  // 如果下一个阶段是 handoff，直接构造 finish 响应（从 session 已收集的数据）
  if (nextPhase === 'handoff') {
    console.log(`[onboarding.next] Auto-completing handoff for session ${sessionId}`);

    // 从 session 上下文和 stateJson 中提取所有已收集的数据
    const allState = {
      ...stateJson,
      ...(updateFields.stateJson as Record<string, unknown> ?? {}),
    };

    // 从 stateJson 的 phase_response 中提取用户选择
    // phase 顺序: exploration → calibration → focus → mode → source
    const modeResponse = (allState.mode_response as string) ?? '';
    // 从 mode 选项文本中提取模式名（如 "⚡ 标准版 (Fast) — ..." → "Fast"）
    const extractedMode = modeResponse.includes('Deep') ? 'Deep'
      : modeResponse.includes('Fast') ? 'Fast'
      : modeResponse.includes('Light') ? 'Light'
      : (session.mode as string) || 'Fast';

    const finishData = {
      topic: (session.topic as string) || (allState.topic as string) || (allState.exploration_response as string) || 'General Topic',
      level: (session.level as string) || (allState.level as string) || 'Beginner',
      verifiedConcept: (session.verifiedConcept as string) || (allState.verifiedConcept as string) || (session.topic as string) || 'Core Concept',
      focus: (session.focus as string) || (allState.focus_response as string) || 'theory',
      source: (allState.source_response as string) || (input.userChoice as string) || 'self',
      mode: extractedMode,
      intent: 'learn',
    };

    // 写入 DB 时确保 enum 值合法
    const validLevels = ['Novice', 'Beginner', 'Intermediate', 'Advanced'];
    const validModes = ['Deep', 'Fast', 'Light'];
    const dbLevel = validLevels.includes(finishData.level) ? finishData.level : 'Beginner';
    const dbMode = validModes.includes(finishData.mode) ? finishData.mode : 'Fast';

    await db
      .update(onboardingSessions)
      .set({
        phase: 'completed' as const,
        topic: finishData.topic,
        level: dbLevel as 'Novice' | 'Beginner' | 'Intermediate' | 'Advanced',
        verifiedConcept: finishData.verifiedConcept,
        focus: finishData.focus,
        mode: dbMode as 'Deep' | 'Fast' | 'Light',
        source: finishData.source,
        intent: finishData.intent,
      })
      .where(eq(onboardingSessions.id, sessionId));

    if (userId) {
      await db
        .update(profiles)
        .set({ onboardingCompleted: true })
        .where(eq(profiles.id, userId));
    }

    console.log(`[onboarding.next] Session ${sessionId} handoff completed with data:`, finishData);

    return {
      type: 'finish',
      message: llmResult.message,
      data: finishData,
      sessionId,
    };
  }

  return {
    type: 'chat',
    message: llmResult.message,
    options: llmResult.options,
    sessionId,
  };
}
