import crypto from 'crypto';
import { db } from '../db';
import { promptRuns } from '../db/schema';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface LLMResponse {
  requestId: string;
  promptName: string;
  promptHash: string;
  rawText: string;
  parsedData: Record<string, unknown> | string | null;
  success: boolean;
  retries: number;
  latencyMs: number;
  model: string;
}

export type OutputFormat = 'json' | 'yaml' | 'markdown' | 'text';

// ─── 环境变量配置 ─────────────────────────────────────────────────────────────

const LLM_MODEL = process.env.LITELLM_MODEL ?? 'gemini-3.1-flash-lite-preview';
const LLM_API_KEY = process.env.EVOBOOK_LLM_KEY ?? '';
const LLM_BASE_URL = process.env.LITELLM_BASE_URL ?? 'https://generativelanguage.googleapis.com';
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT ?? '60', 10) * 1000;
const LLM_MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES ?? '2', 10);
const USE_MOCK_LLM = process.env.MOCK_LLM === 'true';

// ─── Mock 数据（MOCK_LLM=true 时跳过所有真实 LLM 调用） ─────────────────────

const MOCK_RESPONSES: Record<string, string> = {
  dag: JSON.stringify({
    map_meta: {
      course_name: 'Mock Course',
      strategy_rationale: 'Mock strategy',
      mode: 'Fast',
      time_budget_minutes: 60,
      time_sum_minutes: 60,
      time_delta_minutes: 0,
    },
    nodes: [
      { id: 1, title: 'Introduction', description: 'Getting started', type: 'learn', layer: 1, pre_requisites: [], estimated_minutes: 15 },
      { id: 2, title: 'Core Concepts', description: 'Main ideas', type: 'learn', layer: 2, pre_requisites: [1], estimated_minutes: 20 },
      { id: 3, title: 'Practice', description: 'Hands on', type: 'learn', layer: 2, pre_requisites: [1], estimated_minutes: 15 },
      { id: 4, title: 'Quiz', description: 'Test knowledge', type: 'quiz', layer: 3, pre_requisites: [2, 3], estimated_minutes: 10 },
    ],
  }),
  knowledge_card: JSON.stringify({
    type: 'knowledge_card',
    node_id: 1,
    totalPagesInCard: 2,
    markdown: '## Introduction\\n\\nThis is a mock knowledge card.\\n\\n<EVOBK_PAGE_BREAK />\\n\\n## Details\\n\\nMore content here.',
    yaml: 'key_elements:\\n  - Point 1\\n  - Point 2\\nexpert_tips:\\n  - Tip 1',
  }),
  clarification: JSON.stringify({
    type: 'clarification',
    corrected_title: 'Mock Question',
    short_answer: 'This is a mock clarification answer.',
  }),
  qa_detail: JSON.stringify({
    type: 'qa_detail',
    title: 'Mock QA Detail',
    body_markdown: '## Answer\\n\\nDetailed mock answer here.',
    image: { placeholder: 'Mock diagram', prompt: 'A simple diagram' },
  }),
  quiz: JSON.stringify({
    type: 'quiz',
    title: 'Mock Quiz',
    greeting: { topicsIncluded: ['Topic 1'], message: 'Ready?' },
    questions: [
      { qtype: 'single', prompt: 'What is 1+1?', options: ['1', '2', '3'], answer: '2' },
      { qtype: 'boolean', prompt: 'The sky is blue.', answer: 'True' },
    ],
  }),
};

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function calculatePromptHash(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateOutput(
  text: string,
  format: OutputFormat,
): Record<string, unknown> | string {
  switch (format) {
    case 'json': {
      const cleaned = text
        .replace(/^```(?:json)?\s*\n?/m, '')
        .replace(/\n?```\s*$/m, '')
        .trim();
      const parsed: unknown = JSON.parse(cleaned);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('JSON output is not an object');
      }
      return parsed as Record<string, unknown>;
    }
    case 'yaml': {
      if (!text || text.trim().length === 0) {
        throw new Error('YAML output is empty');
      }
      return text.trim();
    }
    case 'markdown': {
      if (!text || text.trim().length < 10) {
        throw new Error('Markdown output is too short or empty');
      }
      return text.trim();
    }
    case 'text':
    default:
      return text;
  }
}

// ─── Gemini 原生 API 调用 ────────────────────────────────────────────────────

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

async function callGeminiAPI(
  promptText: string,
  systemMessage?: string,
): Promise<string> {
  const url = `${LLM_BASE_URL}/v1beta/models/${LLM_MODEL}:generateContent`;

  const contents: GeminiContent[] = [
    { role: 'user', parts: [{ text: promptText }] },
  ];

  const body: Record<string, unknown> = { contents };

  if (systemMessage) {
    body.systemInstruction = {
      parts: [{ text: systemMessage }],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': LLM_API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`Gemini API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned no text content');
  }

  return text;
}

// ─── 核心函数 ─────────────────────────────────────────────────────────────────

export async function completeLLM(options: {
  promptName: string;
  promptText: string;
  variables?: Record<string, string>;
  outputFormat?: OutputFormat;
  systemMessage?: string;
}): Promise<LLMResponse> {
  const {
    promptName,
    promptText: rawPromptText,
    variables,
    outputFormat = 'text',
    systemMessage,
  } = options;

  // 全局 mock 模式：跳过所有 LLM 调用，返回预设数据
  if (USE_MOCK_LLM) {
    const mockText = MOCK_RESPONSES[promptName] ?? '{"message": "Mock response", "options": ["A", "B"]}';
    const parsedData = outputFormat === 'json' ? JSON.parse(mockText) as Record<string, unknown> : mockText;
    console.log(`[llm] MOCK mode: prompt=${promptName}, outputFormat=${outputFormat}`);
    return {
      requestId: crypto.randomUUID(),
      promptName,
      promptHash: 'mock',
      rawText: mockText,
      parsedData,
      success: true,
      retries: 0,
      latencyMs: 0,
      model: 'mock',
    };
  }

  const requestId = crypto.randomUUID();
  const hashSource = (systemMessage ?? '') + rawPromptText;
  const promptHash = calculatePromptHash(hashSource);

  let promptText = rawPromptText;
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      promptText = promptText.replaceAll(`{${key}}`, value);
    }
  }

  const startTime = performance.now();
  let retries = 0;
  let lastError: Error | null = null;
  let rawText = '';

  const maxAttempts = LLM_MAX_RETRIES + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      rawText = await callGeminiAPI(promptText, systemMessage);
      const parsedData = validateOutput(rawText, outputFormat);
      const latencyMs = Math.round(performance.now() - startTime);

      const response: LLMResponse = {
        requestId,
        promptName,
        promptHash,
        rawText,
        parsedData,
        success: true,
        retries,
        latencyMs,
        model: LLM_MODEL,
      };

      persistPromptRun(response).catch((err) =>
        console.error(`[llm] Failed to persist prompt run: ${err}`),
      );

      console.log(
        `[llm] Completion success: requestId=${requestId}, prompt=${promptName}, ` +
          `retries=${retries}, latencyMs=${latencyMs}`,
      );

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      retries = attempt + 1;

      if (attempt < maxAttempts - 1) {
        const delay = 2 ** attempt * 1000;
        console.warn(
          `[llm] Attempt ${attempt + 1} failed for prompt="${promptName}", ` +
            `retrying in ${delay}ms: ${lastError.message}`,
        );
        await sleep(delay);
      }
    }
  }

  const latencyMs = Math.round(performance.now() - startTime);

  const failedResponse: LLMResponse = {
    requestId,
    promptName,
    promptHash,
    rawText,
    parsedData: null,
    success: false,
    retries,
    latencyMs,
    model: LLM_MODEL,
  };

  persistPromptRun(failedResponse).catch((err) =>
    console.error(`[llm] Failed to persist prompt run: ${err}`),
  );

  console.error(
    `[llm] Completion failed: requestId=${requestId}, prompt=${promptName}, ` +
      `retries=${retries}, latencyMs=${latencyMs}, error=${lastError?.message}`,
  );

  throw lastError ?? new Error(`LLM call failed after ${retries} retries`);
}

// ─── 数据库记录 ──────────────────────────────────────────────────────────────

async function persistPromptRun(response: LLMResponse): Promise<void> {
  try {
    await db.insert(promptRuns).values({
      requestId: response.requestId,
      promptName: response.promptName,
      promptHash: response.promptHash,
      model: response.model,
      success: response.success,
      retries: response.retries,
      latencyMs: response.latencyMs,
      rawText: response.rawText.slice(0, 10000),
      parsedJson:
        typeof response.parsedData === 'object' ? response.parsedData : null,
    });
  } catch (err) {
    console.error(`[llm] DB insert prompt_runs failed: ${err}`);
  }
}
