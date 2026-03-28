import crypto from 'crypto';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
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

const LLM_MODEL = process.env.LITELLM_MODEL ?? 'gpt-4o-mini';
const LLM_BASE_URL = process.env.LITELLM_BASE_URL;
const LLM_API_KEY = process.env.LITELLM_API_KEY ?? '';
const LLM_TIMEOUT_MS =
  parseInt(process.env.LLM_TIMEOUT ?? '60', 10) * 1000;
const LLM_MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES ?? '2', 10);

// ─── OpenAI-compatible provider ──────────────────────────────────────────────

const openai = createOpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: LLM_API_KEY,
});

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function calculatePromptHash(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 验证并解析 LLM 输出。
 * - json: 尝试 JSON.parse，返回对象
 * - yaml: 仅检查非空（前端负责解析）
 * - markdown: 非空 + 最小长度检查
 * - text: 原样返回
 */
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

  const requestId = crypto.randomUUID();
  // hash 基于原始模板（systemMessage + promptText），用于追踪 prompt 版本
  const hashSource = (systemMessage ?? '') + rawPromptText;
  const promptHash = calculatePromptHash(hashSource);

  // 变量替换（{key} → value）
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
      const result = await generateText({
        model: openai(LLM_MODEL),
        prompt: promptText,
        ...(systemMessage ? { system: systemMessage } : {}),
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });

      rawText = result.text;
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

      // 异步记录到数据库，不阻塞返回
      persistPromptRun(response).catch((err) =>
        console.error(`[llm] Failed to persist prompt run: ${err}`),
      );

      console.log(
        `[llm] Completion success: requestId=${requestId}, prompt=${promptName}, ` +
          `hash=${promptHash.slice(0, 16)}..., retries=${retries}, latencyMs=${latencyMs}`,
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

  // 所有重试均失败
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
