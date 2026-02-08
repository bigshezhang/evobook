/**
 * Zustand store for application-wide state.
 *
 * Replaces scattered localStorage usage for onboarding flow,
 * course selection, and related transient app state.
 * Uses persist middleware to survive page refreshes.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FinishData } from '../api';

// ── Types ──────────────────────────────────────────────

interface AppState {
  /** Whether the user has completed onboarding at least once */
  onboardingCompleted: boolean;
  /** Onboarding finish data (topic, level, focus, etc.) */
  onboardingData: FinishData | null;
  /** Topic selected in InterestSelection */
  selectedTopic: string | null;
  /** Current assessment session ID */
  assessmentSessionId: string | null;
  /** User's "main course" preference */
  mainCourse: string | null;
}

interface AppActions {
  setOnboardingCompleted: (completed: boolean) => void;
  setOnboardingData: (data: FinishData | null) => void;
  setSelectedTopic: (topic: string | null) => void;
  setAssessmentSessionId: (sessionId: string | null) => void;
  setMainCourse: (course: string | null) => void;
  /** Clear onboarding-related transient state (topic, sessionId, data) */
  clearOnboarding: () => void;
  /** Full reset — used on logout */
  reset: () => void;
}

type AppStore = AppState & AppActions;

// ── Defaults ───────────────────────────────────────────

const INITIAL_STATE: AppState = {
  onboardingCompleted: false,
  onboardingData: null,
  selectedTopic: null,
  assessmentSessionId: null,
  mainCourse: null,
};

// ── Store ──────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      // Actions
      setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),
      setOnboardingData: (data) => set({ onboardingData: data }),
      setSelectedTopic: (topic) => set({ selectedTopic: topic }),
      setAssessmentSessionId: (sessionId) => set({ assessmentSessionId: sessionId }),
      setMainCourse: (course) => set({ mainCourse: course }),

      clearOnboarding: () =>
        set({
          selectedTopic: null,
          assessmentSessionId: null,
          onboardingData: null,
        }),

      reset: () => set({ ...INITIAL_STATE }),
    }),
    {
      name: 'evo-app-store',
      // Migrate legacy localStorage keys on first load
      onRehydrateStorage: () => {
        return (_state, _error) => {
          const store = useAppStore.getState();
          let migrated = false;

          const legacyCompleted = localStorage.getItem('evo_onboarding_completed');
          if (legacyCompleted === 'true' && !store.onboardingCompleted) {
            store.setOnboardingCompleted(true);
            migrated = true;
          }

          const legacyData = localStorage.getItem('evo_onboarding_data');
          if (legacyData && !store.onboardingData) {
            try {
              store.setOnboardingData(JSON.parse(legacyData));
              migrated = true;
            } catch { /* ignore corrupted data */ }
          }

          const legacyTopic = localStorage.getItem('evo_selected_topic');
          if (legacyTopic && !store.selectedTopic) {
            store.setSelectedTopic(legacyTopic);
            migrated = true;
          }

          const legacySessionId = localStorage.getItem('evo_assessment_session_id');
          if (legacySessionId && !store.assessmentSessionId) {
            store.setAssessmentSessionId(legacySessionId);
            migrated = true;
          }

          const legacyMainCourse = localStorage.getItem('evo_main_course');
          if (legacyMainCourse && !store.mainCourse) {
            store.setMainCourse(legacyMainCourse);
            migrated = true;
          }

          // Clean up legacy keys after migration
          if (migrated) {
            localStorage.removeItem('evo_onboarding_completed');
            localStorage.removeItem('evo_onboarding_data');
            localStorage.removeItem('evo_selected_topic');
            localStorage.removeItem('evo_assessment_session_id');
            localStorage.removeItem('evo_main_course');
          }
        };
      },
    },
  ),
);

// ── Global Reset (for logout) ──────────────────────────

import { useMascotStore } from './mascotStore';
import { useLanguageStore } from './languageStore';

/**
 * Reset all Zustand stores. Call this on logout.
 */
export function resetAllStores(): void {
  useAppStore.getState().reset();
  useMascotStore.getState().reset();
  useLanguageStore.getState().reset();

  // Clear persisted store data from localStorage
  localStorage.removeItem('evo-app-store');
  localStorage.removeItem('evo-mascot-store');
  localStorage.removeItem('evo-language-store');
}
