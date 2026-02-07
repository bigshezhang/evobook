/**
 * API client for EvoBook backend
 */

import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Build request headers, injecting the Supabase auth token when available.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch {
    // If fetching the session fails we still send the request without auth.
    // The backend will return 401 if auth is required.
  }

  return headers;
}

// ==================== Common Types ====================

export type Level = 'Novice' | 'Beginner' | 'Intermediate' | 'Advanced';
export type Mode = 'Deep' | 'Fast' | 'Light';
export type NodeType = 'learn' | 'quiz' | 'boss';
export type Language = 'en' | 'zh';

// ==================== Onboarding API Types ====================

export interface OnboardingNextRequest {
  session_id?: string | null;
  user_message?: string | null;
  user_choice?: string | null;
  initial_topic?: string | null;  // Pre-selected topic to skip Phase 1
}

export interface ChatResponse {
  type: 'chat';
  message: string;
  options: string[];
  session_id: string;
}

export interface FinishData {
  topic: string;
  level: Level;
  verified_concept: string;
  focus: string;
  source: string;
  intent: 'add_info' | 'change_topic';
}

export interface FinishResponse {
  type: 'finish';
  data: FinishData;
  session_id: string;
}

export type OnboardingResponse = ChatResponse | FinishResponse;

// ==================== Course Map API Types ====================

export interface CourseMapGenerateRequest {
  topic: string;
  level: Level;
  focus: string;
  verified_concept: string;
  mode: Mode;
  total_commitment_minutes: number;
}

export interface MapMeta {
  course_name: string;
  strategy_rationale: string;
  mode: Mode;
  time_budget_minutes: number;
  time_sum_minutes: number;
  time_delta_minutes: number;
}

export interface DAGNode {
  id: number;
  title: string;
  description: string;
  type: NodeType;
  layer: number;
  pre_requisites: number[];
  estimated_minutes: number;
}

export interface CourseMapGenerateResponse {
  course_map_id: string;  // UUID of the saved course map
  map_meta: MapMeta;
  nodes: DAGNode[];
}

// ==================== Knowledge Card API Types ====================

export interface CourseInfo {
  course_name: string;
  course_context: string;
  topic: string;
  level: Level;
  mode: Mode;
}

export interface NodeInfo {
  id: number;
  title: string;
  description: string;
  type: 'learn' | 'boss';
  estimated_minutes: number;
}

export interface KnowledgeCardRequest {
  course_map_id: string;  // Course map UUID
  course: CourseInfo;
  node: NodeInfo;
}

export interface KnowledgeCardResponse {
  type: 'knowledge_card';
  node_id: number;
  totalPagesInCard: number;
  markdown: string;
  yaml: string;
}

// ==================== Clarification API Types ====================

export interface ClarificationRequest {
  language: Language;
  user_question_raw: string;
  page_markdown: string;
  course_map_id?: string;
  node_id?: number;
}

export interface ClarificationResponse {
  type: 'clarification';
  corrected_title: string;
  short_answer: string;
}

// ==================== QA Detail API Types ====================

export interface QADetailRequest {
  language: Language;
  qa_title: string;
  qa_short_answer: string;
  course_map_id?: string;
  node_id?: number;
}

export interface ImageSpec {
  placeholder: string;
  prompt: string;
}

export interface QADetailResponse {
  type: 'qa_detail';
  title: string;
  body_markdown: string;
  image: ImageSpec;
}

// ==================== Quiz API Types ====================

export interface LearnedTopic {
  topic_name: string;
  pages_markdown: string;
}

export interface QuizGenerateRequest {
  language: Language;
  mode: Mode;
  learned_topics: LearnedTopic[];
}

export interface QuizGreeting {
  topics_included: string[];
  message: string;
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
  greeting: QuizGreeting;
  questions: QuizQuestion[];
}

// ==================== API Error Types ====================

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiRequestError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.details = details;
  }
}

// ==================== Helper Function ====================

async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiError | null = null;
    try {
      errorData = await response.json();
    } catch {
      // Response is not JSON
    }

    if (errorData?.error) {
      throw new ApiRequestError(
        errorData.error.code,
        errorData.error.message,
        errorData.error.details
      );
    }

    throw new ApiRequestError(
      'UNKNOWN_ERROR',
      `API request failed with status ${response.status}`
    );
  }

  return response.json();
}

// ==================== API Functions ====================

/**
 * Call the onboarding/next endpoint to progress through onboarding flow
 */
export async function onboardingNext(request: OnboardingNextRequest): Promise<OnboardingResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/onboarding/next`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  return handleApiResponse<OnboardingResponse>(response);
}

/**
 * Generate a course map (DAG) based on onboarding results
 */
export async function generateCourseMap(request: CourseMapGenerateRequest): Promise<CourseMapGenerateResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/course-map/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  return handleApiResponse<CourseMapGenerateResponse>(response);
}

/**
 * Generate a knowledge card for a specific node
 */
export async function getKnowledgeCard(request: KnowledgeCardRequest): Promise<KnowledgeCardResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/node-content/knowledge-card`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  return handleApiResponse<KnowledgeCardResponse>(response);
}

/**
 * Generate a clarification answer for a user question
 */
export async function getClarification(request: ClarificationRequest): Promise<ClarificationResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/node-content/clarification`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  return handleApiResponse<ClarificationResponse>(response);
}

/**
 * Generate a detailed QA explanation
 */
export async function getQADetail(request: QADetailRequest): Promise<QADetailResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/node-content/qa-detail`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  return handleApiResponse<QADetailResponse>(response);
}

/**
 * Generate a quiz based on learned topics
 */
export async function generateQuiz(request: QuizGenerateRequest): Promise<QuizGenerateResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/quiz/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  return handleApiResponse<QuizGenerateResponse>(response);
}

// ==================== Type Guards ====================

export function isChatResponse(response: OnboardingResponse): response is ChatResponse {
  return response.type === 'chat';
}

export function isFinishResponse(response: OnboardingResponse): response is FinishResponse {
  return response.type === 'finish';
}

// ==================== LocalStorage Keys ====================

export const STORAGE_KEYS = {
  ONBOARDING_DATA: 'evo_onboarding_data',
  COURSE_MAP: 'evo_course_map',
  CURRENT_NODE: 'evo_current_node',
  LEARNED_TOPICS: 'evo_learned_topics',
  NODE_PROGRESS: 'evo_node_progress',
  /** Prefix for per-node Q&A history: `${QA_HISTORY_PREFIX}${courseMapId}_${nodeId}` */
  QA_HISTORY_PREFIX: 'evo_qa_history_',
} as const;

// ==================== URL Navigation Helpers ====================

/**
 * Build a learning page URL with course/node identification query params.
 * e.g. buildLearningPath('/knowledge-card', { cid: 'abc', nid: 3 })
 *   => '/knowledge-card?cid=abc&nid=3'
 */
export function buildLearningPath(
  base: string,
  params: { cid?: string | null; nid?: number | null },
): string {
  const sp = new URLSearchParams();
  if (params.cid) sp.set('cid', params.cid);
  if (params.nid != null) sp.set('nid', String(params.nid));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Read the current course_map_id from localStorage (convenience for components
 * that don't have it in their own state, like BottomNav).
 */
export function getStoredCourseMapId(): string | null {
  try {
    const str = localStorage.getItem(STORAGE_KEYS.COURSE_MAP);
    if (!str) return null;
    const data = JSON.parse(str) as CourseMapGenerateResponse;
    return data.course_map_id || null;
  } catch {
    return null;
  }
}
