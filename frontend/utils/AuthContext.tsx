/**
 * Authentication hook backed by Zustand store.
 *
 * Formerly a React Context; now a thin wrapper around useAuthStore.
 * The useAuth() hook signature is preserved for backward compatibility
 * so all consumers continue to work without modification.
 *
 * Auth listener initialization is handled by initAuthListener() in
 * authStore.ts, called once in App.tsx.
 */

import { useAuthStore } from './stores/authStore';
import type { User, Session } from '@supabase/supabase-js';

// ── Types (unchanged) ──────────────────────────────────

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  /** True while the initial session check is in progress */
  loading: boolean;
  /** Sign the current user out and clear the session */
  signOut: () => Promise<void>;
}

// ── Hook (signature unchanged) ─────────────────────────

export function useAuth(): AuthContextValue {
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);

  return { user, session, loading, signOut };
}

// Re-export initAuthListener so App.tsx can call it
export { initAuthListener } from './stores/authStore';
