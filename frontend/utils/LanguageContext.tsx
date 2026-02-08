/**
 * Language Context for managing application language settings
 * Detects browser language and provides it to all components
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { Language } from './api';

interface LanguageContextType {
  language: Language;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Detect browser language and return ISO 639-1 language code
 * @returns Browser's primary language code (e.g., 'en', 'zh', 'es', 'fr', 'ja', 'de', etc.)
 */
function detectBrowserLanguage(): Language {
  // Get browser language preference
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  
  // Extract primary language code (e.g., 'en' from 'en-US', 'zh' from 'zh-CN')
  const primaryLang = browserLang.split('-')[0].toLowerCase();
  
  return primaryLang;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Detect language once on mount and memoize it
  const language = useMemo(() => detectBrowserLanguage(), []);

  const value = useMemo(() => ({ language }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * Hook to access the current language setting
 * @returns The current language code (e.g., 'en', 'zh', 'es', 'fr', 'ja', 'de', etc.)
 */
export const useLanguage = (): Language => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context.language;
};
