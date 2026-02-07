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

export interface CourseListItem {
  course_map_id: string;
  topic: string;
  level: string;
  mode: string;
  map_meta: Record<string, any>;
  nodes: Record<string, any>[];
  created_at: string;
  progress_percentage: number;
}

export interface CourseListResponse {
  courses: CourseListItem[];
}

export interface CourseDetailResponse {
  course_map_id: string;
  topic: string;
  level: string;
  mode: string;
  focus: string;
  verified_concept: string;
  total_commitment_minutes: number;
  map_meta: Record<string, any>;
  nodes: Record<string, any>[];
  created_at: string;
}

// ==================== Node Progress API Types ====================

export interface NodeProgressItem {
  node_id: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  updated_at: string;
}

export interface GetProgressResponse {
  progress: NodeProgressItem[];
}

export interface UpdateProgressRequest {
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
}

export interface BatchUpdateItem {
  node_id: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
}

export interface BatchUpdateRequest {
  updates: BatchUpdateItem[];
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
 * Get all course maps for the authenticated user
 */
export async function getUserCourses(): Promise<CourseListResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/course-map/list`, {
    method: 'GET',
    headers,
  });

  return handleApiResponse<CourseListResponse>(response);
}

/**
 * Get a single course map by ID
 */
export async function getCourseDetail(courseMapId: string): Promise<CourseDetailResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/course-map/${courseMapId}`, {
    method: 'GET',
    headers,
  });

  return handleApiResponse<CourseDetailResponse>(response);
}

/**
 * Get node progress for a course map
 */
export async function getNodeProgress(courseMapId: string): Promise<GetProgressResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/node-progress/${courseMapId}`, {
    method: 'GET',
    headers,
  });

  return handleApiResponse<GetProgressResponse>(response);
}

/**
 * Update progress for a single node
 */
export async function updateNodeProgress(
  courseMapId: string,
  nodeId: number,
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed'
): Promise<NodeProgressItem> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/node-progress/${courseMapId}/${nodeId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status }),
  });

  return handleApiResponse<NodeProgressItem>(response);
}

/**
 * Batch update multiple node progresses
 */
export async function batchUpdateNodeProgress(
  courseMapId: string,
  updates: BatchUpdateItem[]
): Promise<GetProgressResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/node-progress/${courseMapId}/batch`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ updates }),
  });

  return handleApiResponse<GetProgressResponse>(response);
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

/**
 * Get the active course map ID for the authenticated user
 */
export async function getActiveCourse(): Promise<{ course_map_id: string | null }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/profile/active-course`, {
    method: 'GET',
    headers,
  });

  return handleApiResponse<{ course_map_id: string | null }>(response);
}

/**
 * Set the active course map for the authenticated user
 */
export async function setActiveCourse(courseMapId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/profile/active-course`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ course_map_id: courseMapId }),
  });

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
}

// ==================== Type Guards ====================

export function isChatResponse(response: OnboardingResponse): response is ChatResponse {
  return response.type === 'chat';
}

export function isFinishResponse(response: OnboardingResponse): response is FinishResponse {
  return response.type === 'finish';
}

// ==================== LocalStorage Keys ====================

/**
 * localStorage keys for temporary client-side state.
 * 
 * ⚠️ IMPORTANT: Only use localStorage for non-critical, temporary UI state.
 * All user data and learning progress should be stored in the backend.
 */
export const STORAGE_KEYS = {
  /** @deprecated Use backend API instead - kept for onboarding session only */
  ONBOARDING_DATA: 'evo_onboarding_data',
  
  /** @deprecated All course data is now loaded from backend API */
  COURSE_MAP: 'evo_course_map',
  
  /** @deprecated Node selection is now via URL parameters */
  CURRENT_NODE: 'evo_current_node',
  
  /** @deprecated Learned topics are derived from backend node_progress API */
  LEARNED_TOPICS: 'evo_learned_topics',
  
  /** @deprecated Node progress is now stored in backend database */
  NODE_PROGRESS: 'evo_node_progress',
  
  /** 
   * Prefix for per-node Q&A history: `${QA_HISTORY_PREFIX}${courseMapId}_${nodeId}`
   * @note This is acceptable for localStorage as Q&A is ephemeral interaction state
   */
  QA_HISTORY_PREFIX: 'evo_qa_history_',
} as const;

// ==================== Learning Activities API ====================

export interface LearningActivity {
  id: string;
  course_map_id: string;
  node_id: number;
  activity_type: string;
  completed_at: string; // ISO 8601 UTC timestamp
  extra_data: Record<string, any> | null;
}

export interface LearningActivitiesResponse {
  activities: LearningActivity[];
  total: number;
}

/**
 * Get user's learning activities for the past N days.
 * Returns raw UTC timestamps - frontend handles timezone conversion.
 * 
 * @param days - Number of days to look back (default: 180, max: 365)
 * @returns Learning activities with UTC timestamps
 */
export async function getLearningActivities(
  days: number = 180
): Promise<LearningActivitiesResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/v1/profile/learning-activities?days=${days}`,
    { headers }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to fetch learning activities: ${response.status}`
    );
  }

  return response.json();
}

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
 * 
 * @deprecated Use getActiveCourse() API instead. This localStorage-based approach
 * is unreliable and doesn't reflect the backend's active course state.
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

// ==================== Learning Session API (Heartbeat) ====================

export interface HeartbeatRequest {
  course_map_id: string;
  node_id: number;
  client_timestamp?: string;
}

export interface HeartbeatResponse {
  acknowledged: boolean;
  total_study_seconds: number;
  reason?: string;
}

/**
 * Send learning heartbeat to record study time.
 * Client should send a heartbeat every 30 seconds while the user is actively learning.
 * 
 * @param request - Heartbeat request with course_map_id and node_id
 * @returns Heartbeat response with acknowledged status and total study seconds
 */
export async function sendLearningHeartbeat(
  request: HeartbeatRequest
): Promise<HeartbeatResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/learning/heartbeat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to send heartbeat: ${response.status}`
    );
  }

  return response.json();
}

// ==================== Profile Stats API ====================

export interface ProfileStats {
  total_study_hours: number;
  total_study_seconds: number;
  completed_courses_count: number;
  mastered_nodes_count: number;
  global_rank: number | null;
  rank_percentile: number | null;
  total_users: number;
}

/**
 * Get user's learning statistics including study time, completed courses, and global rank.
 * 
 * @returns Profile statistics
 */
export async function getProfileStats(): Promise<ProfileStats> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/profile/stats`, {
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to fetch profile stats: ${response.status}`
    );
  }

  return response.json();
}
