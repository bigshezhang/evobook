/**
 * Zustand store for Supabase authentication state.
 *
 * Replaces AuthContext. Manages user, session, and loading state.
 * The Supabase auth listener is set up via initAuthListener() which
 * should be called once at app startup (e.g. in App.tsx or an
 * <AuthInitializer /> component).
 */

import { create } from 'zustand';
import { supabase } from '../supabase';
import { getProfile } from '../api';
import { useMascotStore } from './mascotStore';
import type { MascotOutfit } from '../mascotConfig';
import type { User, Session } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────

interface AuthState {
  user: User | null;
  session: Session | null;
  /** True while the initial session check is in progress */
  loading: boolean;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  /** Sign the current user out and clear the session */
  signOut: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

// ── Store ──────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()((set) => ({
  // State
  user: null,
  session: null,
  loading: true,

  // Actions
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));

// ── Auth Listener (call once at startup) ───────────────

let _listenerInitialized = false;

/**
 * Initialize Supabase auth listener and sync profile data.
 * Safe to call multiple times; only the first call takes effect.
 */
export function initAuthListener(): void {
  if (_listenerInitialized) return;
  _listenerInitialized = true;

  const { setUser, setSession, setLoading } = useAuthStore.getState();

  /**
   * Sync user profile from backend and update mascot store.
   */
  const syncUserProfile = async () => {
    try {
      const profile = await getProfile();
      if (profile.mascot) {
        useMascotStore.getState().setCharacter(profile.mascot as any);
      }
      if (profile.current_outfit) {
        useMascotStore.getState().setOutfit(profile.current_outfit as MascotOutfit);
      }
    } catch (error) {
      // Ignore errors during profile sync (user might not have profile yet)
      console.debug('Profile sync skipped:', error);
    }
  };

  // 1. Fetch existing session (e.g. from a stored refresh token)
  supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);

    if (currentSession?.user) {
      syncUserProfile();
    }

    setLoading(false);
  });

  // 2. Subscribe to auth state changes (login, logout, token refresh, etc.)
  supabase.auth.onAuthStateChange((_event, newSession) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);

    if (newSession?.user) {
      syncUserProfile();
    }

    setLoading(false);
  });
}
