/**
 * Centralized route path constants for the entire application.
 *
 * All navigation should reference these constants instead of hardcoded strings.
 * This ensures route paths stay consistent and are easy to refactor.
 */

export const ROUTES = {
  // Auth
  LOGIN: '/login',
  ROOT: '/',

  // Onboarding
  INTERESTS: '/interests',
  ASSESSMENT: '/assessment',
  NICKNAME_SETUP: '/nickname-setup',
  COMPANION: '/companion',
  NOTIFICATIONS: '/notifications',
  GENERATING: '/generating',

  // Learning
  COURSE_DETAIL: '/course-detail',
  KNOWLEDGE_TREE: '/knowledge-tree',
  KNOWLEDGE_CARD: '/knowledge-card',
  QUIZ: '/quiz',
  QUIZ_HISTORY: '/quiz-history',
  QUIZ_ATTEMPT: '/quiz-attempt',
  QA_DETAIL: '/qa-detail',

  // Main
  COURSES: '/courses',
  DISCOVERY: '/discovery',
  PROFILE: '/profile',

  // Game
  GAME: '/game',
  GAME_OUTFIT: '/game/outfit',
} as const;

export type RoutePath = typeof ROUTES[keyof typeof ROUTES];

/**
 * Route groups for tab detection in BottomNav.
 * When adding new routes, update the corresponding group here.
 */
export const ROUTE_GROUPS = {
  COURSES_TAB: [
    ROUTES.COURSES,
    ROUTES.PROFILE,
  ],
  LEARNING_TAB: [
    ROUTES.KNOWLEDGE_TREE,
    ROUTES.KNOWLEDGE_CARD,
    ROUTES.COURSE_DETAIL,
    ROUTES.QUIZ,
    ROUTES.QUIZ_HISTORY,
    ROUTES.QUIZ_ATTEMPT,
    ROUTES.QA_DETAIL,
  ],
  GAME_TAB: [
    ROUTES.GAME,
    ROUTES.GAME_OUTFIT,
  ],
} as const;
