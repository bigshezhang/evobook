/**
 * Zustand store for application language settings.
 *
 * Replaces LanguageContext. Detects browser language on initialization
 * and persists user preference via zustand persist middleware.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '../api';

// ── Types ──────────────────────────────────────────────

interface LanguageState {
  /** Current language code (ISO 639-1, e.g. 'en', 'zh') */
  language: Language;
}

interface LanguageActions {
  /** Update the language preference */
  setLanguage: (language: Language) => void;
  /** Reset to browser-detected language */
  reset: () => void;
}

type LanguageStore = LanguageState & LanguageActions;

// ── Helpers ────────────────────────────────────────────

/**
 * Detect browser language and return ISO 639-1 language code.
 */
function detectBrowserLanguage(): Language {
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  return browserLang.split('-')[0].toLowerCase();
}

// ── Store ──────────────────────────────────────────────

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      // State — initialize from browser
      language: detectBrowserLanguage(),

      // Actions
      setLanguage: (language: Language) => {
        set({ language });
      },

      reset: () => {
        set({ language: detectBrowserLanguage() });
      },
    }),
    {
      name: 'evo-language-store',
    },
  ),
);
