/**
 * Router utilities for EvoBook.
 *
 * This application uses BrowserRouter from react-router-dom.
 *
 * ## Route Format
 *
 * All routes use standard browser URLs:
 * - Example: `http://localhost:3000/knowledge-tree?cid=xxx`
 *
 * ## Navigation Guidelines
 *
 * 1. Use React Router hooks for navigation:
 *    - `useNavigate()` for programmatic navigation
 *    - `<Link>` or `<NavLink>` for declarative navigation
 *
 * 2. Use React Router hooks for URL parameters:
 *    - `useSearchParams()` for query parameters
 *    - `useLocation()` for location state
 *
 * 3. Import route paths from `utils/routes.ts`:
 *    - `import { ROUTES } from './routes';`
 *    - `navigate(ROUTES.COURSES)` instead of `navigate('/courses')`
 *
 * 4. Use `buildLearningPath()` from `utils/api.ts` for routes with query params:
 *    - `navigate(buildLearningPath(ROUTES.KNOWLEDGE_CARD, { cid: 'abc', nid: 1 }))`
 */

import { ROUTES } from './routes';

/**
 * Build an invite URL for sharing.
 *
 * @param baseUrl - Base URL of the application (e.g. "https://app.evobook.ai")
 * @param inviteCode - Invite code to include
 * @returns Properly formatted invite URL
 */
export function buildInviteURL(baseUrl: string, inviteCode: string): string {
  return `${baseUrl}${ROUTES.LOGIN}?invite=${inviteCode}`;
}

/**
 * Validate that a route path is well-formed.
 * Used for development/testing to catch route format errors.
 *
 * @param path - Path to validate
 * @returns True if valid, false otherwise
 */
export function isValidRoute(path: string): boolean {
  // Valid routes start with / and don't contain protocol or domain
  if (!path.startsWith('/')) return false;
  if (path.includes('://')) return false;

  return true;
}
