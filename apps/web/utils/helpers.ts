/**
 * 保留的纯工具函数和类型别名。
 * 所有 API 调用已迁移到 tRPC（utils/trpc/client.ts）。
 */

export { STORAGE_KEYS, BUSINESS_CONFIG } from './constants';
export type { Level, Mode, NodeType, NodeStatus } from './constants';

// ISO 639-1 语言代码
export type Language = string;

// ─── 仍被组件引用的类型（和 tRPC 返回对齐为 camelCase） ──────────────────

export interface MapMeta {
  courseName: string;
  strategyRationale: string;
  mode: string;
  timeBudgetMinutes: number;
  timeSumMinutes: number;
  timeDeltaMinutes: number;
}

export interface DAGNode {
  id: number;
  title: string;
  description: string;
  type: string;
  layer: number;
  preRequisites: number[];
  estimatedMinutes: number;
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
