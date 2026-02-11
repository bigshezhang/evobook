/**
 * Preset copy for onboarding / course customization flow.
 *
 * Provides localized first-question presets so users see interactive content
 * immediately without waiting for the backend LLM. Fallback to English when
 * the user's language is not supported (aligned with backend SUPPORTED_LANGUAGES).
 */

import type { Language } from './api';

const SUPPORTED_LANGUAGES = new Set(['en', 'zh']);
const DEFAULT_LANGUAGE = 'en';

const PRESETS = {
  en: {
    message: 'What would you like to learn?',
    options: ['Machine Learning', 'Product Design', 'Language Learning'],
  },
  zh: {
    message: '你想学习什么？',
    options: ['机器学习', '产品设计', '语言学习'],
  },
} as const;

export interface FirstQuestionPreset {
  message: string;
  options: string[];
}

/**
 * Get the preset first question for the onboarding flow.
 * Uses the user's interaction language; falls back to English if not supported.
 */
export function getFirstQuestionPreset(language: Language): FirstQuestionPreset {
  const lang = typeof language === 'string' ? language.split('-')[0].toLowerCase() : '';
  const key = SUPPORTED_LANGUAGES.has(lang) ? lang : DEFAULT_LANGUAGE;
  return { ...PRESETS[key] };
}
