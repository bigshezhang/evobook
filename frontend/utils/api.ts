/**
 * API client for EvoBook backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
  const response = await fetch(`${API_BASE_URL}/api/v1/onboarding/next`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleApiResponse<OnboardingResponse>(response);
}

/**
 * Generate a course map (DAG) based on onboarding results
 */
export async function generateCourseMap(request: CourseMapGenerateRequest): Promise<CourseMapGenerateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/course-map/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleApiResponse<CourseMapGenerateResponse>(response);
}

/**
 * Generate a knowledge card for a specific node
 */
export async function getKnowledgeCard(request: KnowledgeCardRequest): Promise<KnowledgeCardResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/node-content/knowledge-card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleApiResponse<KnowledgeCardResponse>(response);
}

/**
 * Generate a clarification answer for a user question
 */
export async function getClarification(request: ClarificationRequest): Promise<ClarificationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/node-content/clarification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleApiResponse<ClarificationResponse>(response);
}

/**
 * Generate a detailed QA explanation
 */
export async function getQADetail(request: QADetailRequest): Promise<QADetailResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/node-content/qa-detail`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleApiResponse<QADetailResponse>(response);
}

/**
 * Generate a quiz based on learned topics
 */
export async function generateQuiz(request: QuizGenerateRequest): Promise<QuizGenerateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/quiz/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
} as const;
