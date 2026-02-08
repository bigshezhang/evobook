/**
 * React context for Supabase authentication state.
 *
 * Wrapping the app with <AuthProvider> gives every descendant access to the
 * current user / session via the useAuth() hook.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getProfile } from './api';
import { setSelectedCharacter, setSelectedOutfit } from './mascotUtils';
import type { MascotOutfit } from './mascotUtils';
import type { User, Session } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  /** True while the initial session check is in progress */
  loading: boolean;
  /** Sign the current user out and clear the session */
  signOut: () => Promise<void>;
}

// ── Context ────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ───────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Helper to sync user profile from backend
    const syncUserProfile = async () => {
      try {
        const profile = await getProfile();
        // Sync mascot character to localStorage if it exists in backend
        if (profile.mascot) {
          setSelectedCharacter(profile.mascot as any);
        }
        // Sync outfit to localStorage if it exists in backend
        if (profile.current_outfit) {
          setSelectedOutfit(profile.current_outfit as MascotOutfit);
        }
      } catch (error) {
        // Ignore errors during profile sync (user might not have profile yet)
        console.debug('Profile sync skipped:', error);
      }
    };

    // 1. Fetch the session that may already exist (e.g. from a stored refresh token)
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      // Sync profile if user is logged in
      if (currentSession?.user) {
        syncUserProfile();
      }

      setLoading(false);
    });

    // 2. Subscribe to auth state changes (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Sync profile when user logs in
        if (newSession?.user) {
          syncUserProfile();
        }

        setLoading(false);
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Hook ───────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
