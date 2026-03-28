import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import containerQueries from '@tailwindcss/container-queries';

export default {
  content: [
    './index.html',
    './**/*.{js,ts,jsx,tsx}',
    '!./node_modules/**',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#1A1B23',
        secondary: '#7C3AED',
        charcoal: '#1A1A1A',
        'background-light': '#F8F9FD',
        'background-dark': '#0F0F12',
        'card-light': '#FFFFFF',
        'card-dark': '#1C1C1E',
        'lavender-pale': '#F0EFFF',
        'accent-purple': '#B6A1FF',
        'accent-blue': '#A4C9FF',
        'accent-orange': '#FFB865',
        'reward-yellow': '#FFF9DB',
        'note-bg': '#F5F3FF',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        display: ['Outfit', 'Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '20px',
        bubble: '24px',
        input: '50px',
        large: '32px',
        card: '24px',
      },
    },
  },
  plugins: [
    forms,
    typography,
    containerQueries,
  ],
} satisfies Config;
