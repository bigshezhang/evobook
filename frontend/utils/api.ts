/**
 * API client for EvoBook backend
 */

import { supabase } from './supabase';
import { STORAGE_KEYS, NODE_STATUS, NODE_TYPE, LEVEL, MODE } from './constants';

// 如果 VITE_API_BASE_URL 为空，使用空字符串（相对路径）
// Vite 开发服务器会代理 /api 和 /healthz 请求到后端
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Build request headers, injecting the Supabase auth token when available.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  // Forward browser language to backend for LLM output localization
  const browserLang = navigator.language || 'en';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': browserLang,
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
      console.debug('[AUTH] Token attached, length:', session.access_token.length, 'expires_at:', session.expires_at);
    } else {
      console.warn('[AUTH] No session or access_token available!', 'session:', session ? 'exists' : 'null');
    }
  } catch (err) {
    // If fetching the session fails we still send the request without auth.
    // The backend will return 401 if auth is required.
    console.error('[AUTH] getSession() failed:', err);
  }

  return headers;
}

// ==================== Common Types ====================
// Import types for internal use
import type { Level, Mode, NodeType, NodeStatus, ActivityIntensity } from './constants';
// Re-export types and constants for external use
export type { Level, Mode, NodeType, NodeStatus, ActivityIntensity };
export { LEVEL, MODE, NODE_TYPE, NODE_STATUS, ACTIVITY_INTENSITY, STORAGE_KEYS, BUSINESS_CONFIG, TIME } from './constants';

// Language is any ISO 639-1 language code (e.g., 'en', 'zh', 'es', 'fr', 'ja', 'de', etc.)
export type Language = string;

// ==================== Onboarding API Types ====================

export interface OnboardingNextRequest {
  session_id?: string | null;
  user_message?: string | null;
  user_choice?: string | null;
  initial_topic?: string | null;  // Pre-selected topic to skip Phase 1
  discovery_preset_id?: string | null;  // Discovery course preset ID for context injection
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
  mode: Mode;
  intent: 'add_info' | 'change_topic';
  interested_concepts?: string[];
}

export interface FinishResponse {
  type: 'finish';
  message: string;
  data: FinishData;
  session_id: string;
}

export interface ConceptListCheckResponse {
  type: 'concept_list_check';
  message: string;
  concepts: string[];
  session_id: string;
}

export type OnboardingResponse = ChatResponse | FinishResponse | ConceptListCheckResponse;

// ==================== Discovery API Types ====================

export interface DiscoveryCourse {
  id: string;
  preset_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string;
  rating: number;
  seed_context: {
    topic: string;
    suggested_level: string;
    key_concepts: string;
    focus: string;
    verified_concept?: string;
  };
}

export interface DiscoveryListResponse {
  courses: DiscoveryCourse[];
  total: number;
}

// ==================== Course Map API Types ====================

export interface CourseMapGenerateRequest {
  topic: string;
  level: Level;
  focus: string;
  verified_concept: string;
  mode: Mode;
  total_commitment_minutes: number;
  interested_concepts?: string[];
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
  status: NodeStatus;
  updated_at: string;
}

export interface GetProgressResponse {
  progress: NodeProgressItem[];
}

export interface UpdateProgressRequest {
  status: NodeStatus;
}

export interface BatchUpdateItem {
  node_id: number;
  status: NodeStatus;
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
  type: 'learn';
  estimated_minutes: number;
}

export interface KnowledgeCardRequest {
  language: Language;
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
 * Get discovery courses by category
 */
export async function getDiscoveryCourses(category?: string): Promise<DiscoveryListResponse> {
  const headers = await getAuthHeaders();
  const url = category
    ? `${API_BASE_URL}/api/v1/discovery/courses?category=${category}`
    : `${API_BASE_URL}/api/v1/discovery/courses`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  return handleApiResponse<DiscoveryListResponse>(response);
}

/**
 * Start a discovery course (increments start_count)
 */
export async function startDiscoveryCourse(presetId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/discovery/courses/${presetId}/start`, {
    method: 'POST',
    headers,
  });

  await handleApiResponse(response);
}

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

export function isConceptListCheckResponse(response: OnboardingResponse): response is ConceptListCheckResponse {
  return response.type === 'concept_list_check';
}

// ==================== LocalStorage Keys ====================

// STORAGE_KEYS is now exported from constants.ts

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
  params: { cid?: string | null; nid?: number | null; aid?: string | null; [key: string]: string | number | null | undefined },
): string {
  const sp = new URLSearchParams();
  if (params.cid) sp.set('cid', params.cid);
  if (params.nid != null) sp.set('nid', String(params.nid));
  if (params.aid) sp.set('aid', params.aid);
  // Support any additional params
  Object.keys(params).forEach(key => {
    if (!['cid', 'nid', 'aid'].includes(key) && params[key] != null) {
      sp.set(key, String(params[key]));
    }
  });
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

// ==================== Profile API ====================

export interface Profile {
  id: string;
  display_name: string | null;
  mascot: string | null;
  onboarding_completed: boolean;
  guides_completed: string[];
  gold_balance: number;
  dice_rolls_count: number;
  level: number;
  current_exp: number;
  current_outfit: string;
  travel_board_position: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdateRequest {
  display_name?: string | null;
  mascot?: string | null;
  onboarding_completed?: boolean | null;
  guides_completed?: string[];
}

/**
 * Get the authenticated user's profile.
 *
 * @returns User profile
 */
export async function getProfile(): Promise<Profile> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/profile`, {
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to fetch profile: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Update the authenticated user's profile.
 *
 * @param updates - Partial profile updates
 * @returns Updated profile
 */
export async function updateProfile(updates: ProfileUpdateRequest): Promise<Profile> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/profile`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to update profile: ${response.status}`
    );
  }

  return response.json();
}

export interface ProfileStats {
  user_name: string;
  joined_date: string; // ISO 8601 format
  total_study_hours: number;
  total_study_seconds: number;
  completed_courses_count: number;
  mastered_nodes_count: number;
  global_rank: number | null;
  rank_percentile: number | null;
  total_users: number;
  invite_code: string;
  successful_invites_count: number;
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

// ==================== Quiz History API ====================

export interface QuizSubmitRequest {
  course_map_id: string;
  node_id: number;
  quiz_json: {
    questions: QuizQuestion[];
    user_answers: Array<{
      questionIdx: number;
      selected: string | string[] | boolean | null;
    }>;
  };
  score: number;
}

export interface QuizSubmitResponse {
  attempt_id: string;
  created_at: string;
}

export interface QuizAttemptSummary {
  id: string;
  node_id: number;
  score: number | null;
  total_questions: number;
  created_at: string;
}

export interface QuizHistoryResponse {
  attempts: QuizAttemptSummary[];
}

export interface QuizAttemptDetail {
  id: string;
  course_map_id: string;
  node_id: number;
  quiz_json: {
    questions: QuizQuestion[];
    user_answers: Array<{
      questionIdx: number;
      selected: string | string[] | boolean | null;
    }>;
  };
  score: number | null;
  created_at: string;
}

/**
 * Submit a quiz attempt with user answers and score.
 *
 * @param request - Quiz submission data
 * @returns Created attempt info
 */
export async function submitQuizAttempt(
  request: QuizSubmitRequest
): Promise<QuizSubmitResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/quiz/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to submit quiz: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Get quiz attempt history for a specific node.
 *
 * @param courseMapId - Course map ID
 * @param nodeId - Quiz node ID
 * @returns List of quiz attempts
 */
export async function getQuizHistory(
  courseMapId: string,
  nodeId: number
): Promise<QuizHistoryResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/v1/quiz/history?course_map_id=${courseMapId}&node_id=${nodeId}`,
    { headers }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to fetch quiz history: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Get full details of a quiz attempt.
 *
 * @param attemptId - Quiz attempt ID
 * @returns Full quiz attempt details
 */
export async function getQuizAttemptDetail(
  attemptId: string
): Promise<QuizAttemptDetail> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/v1/quiz/attempt/${attemptId}`,
    { headers }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to fetch quiz attempt: ${response.status}`
    );
  }

  return response.json();
}

// ==================== Game Currency API ====================

export interface GameCurrencyResponse {
  gold_balance: number;
  dice_rolls_count: number;
  level: number;
  current_exp: number;
  exp_to_next_level: number;
}

/**
 * Get user's game currency data (gold, dice rolls, level, exp).
 *
 * @returns Game currency data
 */
export async function getCurrency(): Promise<GameCurrencyResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/game/currency`, {
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to fetch currency: ${response.status}`
    );
  }

  return response.json();
}

export interface RollDiceRequest {
  course_map_id: string;
  current_position: number;
}

export interface RollDiceResponse {
  dice_result: number;
  dice_rolls_remaining: number;
  new_position: number;
}

/**
 * Roll dice in the travel board game.
 *
 * @param request - Roll dice request
 * @returns Dice result and remaining rolls
 */
export async function rollDice(request: RollDiceRequest): Promise<RollDiceResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/game/roll-dice`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiRequestError(
      errorData.error?.code || 'ROLL_DICE_FAILED',
      errorData.error?.message || `Failed to roll dice: ${response.status}`,
      errorData.error?.details
    );
  }

  return response.json();
}

export interface ClaimRewardRequest {
  reward_type: 'gold' | 'dice' | 'gift';
  amount: number;
  source: string;
  source_details: Record<string, any>;
}

export interface ClaimRewardResponse {
  success: boolean;
  new_balance: number;
}

/**
 * Claim a reward (gold, dice, or gift).
 *
 * @param request - Reward claim request
 * @returns Success status and new balance
 */
export async function claimReward(request: ClaimRewardRequest): Promise<ClaimRewardResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/game/claim-reward`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to claim reward: ${response.status}`
    );
  }

  return response.json();
}

export interface ClaimGiftRequest {
  source_details?: Record<string, any>;
}

export interface GiftItemInfo {
  id: string;
  name: string;
  item_type: string;
  image_path: string;
  rarity: string;
}

export interface ClaimGiftResponse {
  success: boolean;
  reward_type: 'item' | 'gold';
  gold_amount: number | null;
  item: GiftItemInfo | null;
  message: string;
}

/**
 * Claim a gift reward from the travel board.
 * Randomly grants an unowned item, or gold if all items owned.
 *
 * @param request - Gift claim request with optional source details
 * @returns Gift reward details (item info or fallback gold)
 */
export async function claimGiftReward(request: ClaimGiftRequest): Promise<ClaimGiftResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/game/claim-gift`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to claim gift: ${response.status}`
    );
  }

  return response.json();
}

export interface EarnExpRequest {
  exp_amount: number;
  gold_reward?: number;
  dice_reward?: number;
  source: string;
  source_details: Record<string, any>;
}

export interface EarnExpRewards {
  gold: number;
  dice_rolls: number;
}

export interface EarnExpResponse {
  success: boolean;
  exp_earned: number;
  current_exp: number;
  current_level: number;
  level_up: boolean;
  rewards: EarnExpRewards;
}

/**
 * Earn experience points from learning activities.
 *
 * @param request - Experience earn request
 * @returns Experience earned and level up status
 */
export async function earnExp(request: EarnExpRequest): Promise<EarnExpResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/game/earn-exp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to earn exp: ${response.status}`
    );
  }

  return response.json();
}

// ==================== Shop API ====================

export interface ShopItem {
  id: string;
  name: string;
  item_type: 'clothes' | 'furniture';
  price: number;
  image_path: string;
  rarity: string;
  owned: boolean;
  is_equipped: boolean;
}

export interface ShopItemsResponse {
  items: ShopItem[];
  total: number;
}

/**
 * Get shop items by type.
 *
 * @param itemType - Type of items to fetch
 * @returns List of shop items
 */
export async function getShopItems(itemType: 'clothes' | 'furniture'): Promise<ShopItemsResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/v1/shop/items?item_type=${itemType}`,
    { headers }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to fetch shop items: ${response.status}`
    );
  }

  return response.json();
}

export interface PurchaseItemRequest {
  item_id: string;
}

export interface PurchaseItemResponse {
  success: boolean;
  new_gold_balance: number;
  inventory_item_id: string;
}

/**
 * Purchase an item from the shop.
 *
 * @param request - Purchase request
 * @returns Purchase result
 */
export async function purchaseItem(request: PurchaseItemRequest): Promise<PurchaseItemResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/shop/purchase`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiRequestError(
      errorData.error?.code || 'PURCHASE_FAILED',
      errorData.error?.message || `Failed to purchase item: ${response.status}`,
      errorData.error?.details
    );
  }

  return response.json();
}

export interface InventoryItem {
  item_id: string;
  name: string;
  item_type: 'clothes' | 'furniture';
  image_path: string;
  is_equipped: boolean;
  purchased_at: string;
}

export interface UserInventoryResponse {
  inventory: InventoryItem[];
  total: number;
}

/**
 * Get user's inventory items.
 *
 * @param itemType - Optional filter by item type
 * @returns User's inventory items
 */
export async function getUserInventory(itemType?: 'clothes' | 'furniture'): Promise<UserInventoryResponse> {
  const headers = await getAuthHeaders();
  const url = itemType
    ? `${API_BASE_URL}/api/v1/inventory?item_type=${itemType}`
    : `${API_BASE_URL}/api/v1/inventory`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to fetch inventory: ${response.status}`
    );
  }

  return response.json();
}

export interface EquipItemRequest {
  item_id: string;
  equip: boolean;
}

export interface EquipItemResponse {
  success: boolean;
}

/**
 * Equip or unequip an inventory item.
 *
 * @param request - Equip/unequip request
 * @returns Operation result
 */
export async function equipItem(request: EquipItemRequest): Promise<EquipItemResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory/equip`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || `Failed to equip item: ${response.status}`
    );
  }

  return response.json();
}

// ==================== Generation Progress API ====================

export interface NodeGenerationStatus {
  node_id: number;
  type: string;
  status: string;
  error?: string | null;
}

export interface GenerationProgressResponse {
  course_map_id: string;
  overall_status: 'initializing' | 'generating' | 'completed' | 'partial_failed';
  learn_progress: number;
  nodes_status: NodeGenerationStatus[];
}

/**
 * Get generation progress for a course map.
 * Returns the current status of content generation for all nodes.
 *
 * @param courseMapId - Course map UUID
 * @returns Generation progress with node-level status
 */
export async function getGenerationProgress(courseMapId: string): Promise<GenerationProgressResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/v1/course-map/${courseMapId}/progress`,
    {
      headers,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to fetch generation progress: ${response.status}`
    );
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Invite System APIs
// ---------------------------------------------------------------------------

export interface InviteCodeData {
  invite_code: string;
  formatted_code: string;
  invite_url: string;
  successful_invites_count: number;
}

export interface BindInviteResponse {
  success: boolean;
  inviter_name?: string;
  reward?: {
    xp_earned: number;
    message: string;
  };
}

/**
 * Get or create user's invite code.
 *
 * @returns User's invite code data
 */
export async function getInviteCode(): Promise<InviteCodeData> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/profile/invite-code`, {
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to get invite code: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Bind user to an invite code and grant rewards.
 *
 * @param inviteCode - Invite code to bind
 * @returns Binding result with reward info
 */
export async function bindInviteCode(inviteCode: string): Promise<BindInviteResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/bind-invite`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ invite_code: inviteCode }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to bind invite code: ${response.status}`
    );
  }

  return response.json();
}
