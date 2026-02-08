/**
 * Frontend constants for business logic and configuration.
 * 
 * Centralized constants to ensure consistency across the application.
 */

// ==================== Node Status ====================
export const NODE_STATUS = {
  LOCKED: 'locked',
  UNLOCKED: 'unlocked',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

export type NodeStatus = typeof NODE_STATUS[keyof typeof NODE_STATUS];

// ==================== Node Types ====================
export const NODE_TYPE = {
  LEARN: 'learn',
  QUIZ: 'quiz',
  BOSS: 'boss',
} as const;

export type NodeType = typeof NODE_TYPE[keyof typeof NODE_TYPE];

// ==================== Learning Levels ====================
export const LEVEL = {
  NOVICE: 'Novice',
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
} as const;

export type Level = typeof LEVEL[keyof typeof LEVEL];

// ==================== Learning Modes ====================
export const MODE = {
  DEEP: 'Deep',
  FAST: 'Fast',
  LIGHT: 'Light',
} as const;

export type Mode = typeof MODE[keyof typeof MODE];

// ==================== Activity Intensity ====================
export const ACTIVITY_INTENSITY = {
  NONE: 'none',
  LIGHT: 'light',
  MEDIUM: 'medium',
  DEEP: 'deep',
} as const;

export type ActivityIntensity = typeof ACTIVITY_INTENSITY[keyof typeof ACTIVITY_INTENSITY];

// ==================== LocalStorage Keys ====================
export const STORAGE_KEYS = {
  // Onboarding
  ONBOARDING_COMPLETED: 'evo_onboarding_completed',
  ONBOARDING_DATA: 'evo_onboarding_data',
  ASSESSMENT_SESSION_ID: 'evo_assessment_session_id',
  SELECTED_TOPIC: 'evo_selected_topic',
  
  // Course & Learning
  COURSE_MAP: 'evo_course_map',
  MAIN_COURSE: 'evo_main_course',
  CURRENT_NODE: 'evo_current_node',
  LEARNED_TOPICS: 'evo_learned_topics',
  NODE_PROGRESS: 'evo_node_progress',
  
  // QA & Knowledge Card
  QA_HISTORY_PREFIX: 'evo_qa_history_',
  KC_CACHE_PREFIX: 'evo_kc_',
  
  // User customization
  USER_MASCOT: 'evo_user_mascot',
  USER_OUTFIT: 'evo_user_outfit',
  
  // Invite
  PENDING_INVITE_CODE: 'pending_invite_code',
} as const;

// ==================== Business Configuration ====================
export const BUSINESS_CONFIG = {
  // Learning heartbeat
  HEARTBEAT_INTERVAL_MS: 30000, // 30 seconds
  
  // Default course generation
  DEFAULT_MODE: MODE.FAST,
  DEFAULT_COMMITMENT_MINUTES: 120,
  
  // Progress animation
  INITIAL_PROGRESS_PERCENT: 30,
  
  // Time display thresholds
  MINUTES_TO_HOURS_THRESHOLD: 120,
  SECONDS_PER_HOUR: 3600,
  SECONDS_PER_MINUTE: 60,
  
  // Quiz scoring
  QUIZ_PASS_SCORE: 60,
} as const;

// ==================== Time Constants ====================
export const TIME = {
  SECOND_MS: 1000,
  MINUTE_MS: 60000,
  HOUR_MS: 3600000,
  DAY_MS: 86400000,
} as const;
