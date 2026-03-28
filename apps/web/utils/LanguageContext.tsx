/**
 * Language hook backed by Zustand store.
 *
 * Formerly a React Context; now a thin wrapper around useLanguageStore.
 * The useLanguage() hook signature is preserved for backward compatibility.
 */

import { useLanguageStore } from './stores/languageStore';
import type { Language } from './api';

// Re-export Language type for convenience
export type { Language };

/**
 * Hook to access the current language setting.
 * @returns The current language code (e.g., 'en', 'zh', 'es', 'fr', 'ja', 'de', etc.)
 */
export const useLanguage = (): Language => {
  return useLanguageStore((s) => s.language);
};
