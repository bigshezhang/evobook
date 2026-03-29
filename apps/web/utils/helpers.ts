/**
 * 保留的纯工具函数和类型别名。
 * 所有 API 调用已迁移到 tRPC（utils/trpc/client.ts）。
 */

export { STORAGE_KEYS, BUSINESS_CONFIG } from './constants';
export type { Level, Mode, NodeType, NodeStatus } from './constants';

// ISO 639-1 语言代码
export type Language = string;

// onboarding finish data（存储在 appStore 中）
export interface FinishData {
  topic: string;
  level: string;
  verifiedConcept: string;
  focus: string;
  source: string;
  mode: string;
  intent: string;
  interestedConcepts?: string[];
  // 兼容旧 snake_case 数据
  verified_concept?: string;
  interested_concepts?: string[];
  [key: string]: unknown;
}

// ─── 仍被组件引用的类型（和 tRPC 返回对齐为 camelCase） ──────────────────

export interface MapMeta {
  course_name: string;
  strategy_rationale: string;
  mode: string;
  time_budget_minutes: number;
  time_sum_minutes: number;
  time_delta_minutes: number;
  [key: string]: unknown;
}

export interface DAGNode {
  id: number;
  title: string;
  description: string;
  type: string;
  layer: number;
  pre_requisites: number[];
  estimated_minutes: number;
  reward_multiplier?: number;
}

export interface QuizQuestion {
  qtype: 'single' | 'multi' | 'boolean';
  prompt: string;
  options?: string[];
  answer?: string;
  answers?: string[];
}

export interface QuizGenerateResponse {
  type: 'quiz';
  title: string;
  greeting?: { topicsIncluded: string[]; message: string };
  questions: QuizQuestion[];
}

// ─── 纯工具函数 ─────────────────────────────────────────────────────────────

/**
 * 构建带查询参数的学习页面 URL。
 */
export function buildLearningPath(
  base: string,
  params: {
    cid?: string | null;
    nid?: number | null;
    aid?: string | null;
    [key: string]: string | number | null | undefined;
  },
): string {
  const sp = new URLSearchParams();
  if (params.cid) sp.set('cid', params.cid);
  if (params.nid != null) sp.set('nid', String(params.nid));
  if (params.aid) sp.set('aid', params.aid);
  Object.keys(params).forEach((key) => {
    if (!['cid', 'nid', 'aid'].includes(key) && params[key] != null) {
      sp.set(key, String(params[key]));
    }
  });
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}
