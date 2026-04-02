export const colors = {
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  primaryBorder: '#A5B4FC',
  primaryMuted: '#C7D2FE',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#D1D5DB',
  error: '#EF4444',
  success: '#10B981',
  successLight: '#D1FAE5',
  successBorder: '#6EE7B7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningBorder: '#FCD34D',
  codeBackground: '#F3F4F6',
  textDark: '#374151',
  successDark: '#059669',
  successGreen: '#16A34A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '800' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24 },
  bodySmall: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 12 },
  captionSmall: { fontSize: 11 },
} as const;

// 节点状态颜色
export const nodeStatusColors = {
  locked: { bg: '#F3F4F6', text: '#9CA3AF', border: '#D1D5DB' },
  unlocked: { bg: colors.primaryLight, text: colors.primary, border: colors.primaryBorder },
  in_progress: { bg: colors.warningLight, text: colors.warning, border: colors.warningBorder },
  completed: { bg: colors.successLight, text: colors.success, border: colors.successBorder },
  generating: { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
} as const;
