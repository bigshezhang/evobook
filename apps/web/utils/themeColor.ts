/**
 * 动态更新页面 theme-color，影响移动端状态栏颜色
 * 用于实现沉浸式全屏体验
 */

/**
 * 更新 theme-color meta 标签
 * @param color - 十六进制颜色值，例如 "#FFFFFF" 或 "#F9F9F9"
 */
export function setThemeColor(color: string): void {
  // 查找或创建 theme-color meta 标签
  let metaThemeColor = document.querySelector('meta[name="theme-color"]');

  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.setAttribute('name', 'theme-color');
    document.head.appendChild(metaThemeColor);
  }

  metaThemeColor.setAttribute('content', color);
}

/**
 * 预定义的页面主题色
 */
export const PAGE_THEME_COLORS = {
  // 白色背景页面
  WHITE: '#FFFFFF',

  // 浅灰色背景（Onboarding 页面）
  LIGHT_GRAY: '#F9F9F9',

  // 浅蓝灰色背景（学习页面）
  LIGHT_BLUE_GRAY: '#F8F9FD',

  // 浅紫色背景（通知权限页面）
  LIGHT_PURPLE: '#EFE9FF',

  // 深色背景
  DARK: '#1A1B23',

  // 紫色主题
  PURPLE: '#7C3AED',

  // 游戏页面背景
  GAME: '#F5F3FF',
} as const;

/**
 * React Hook: 在组件挂载时设置 theme-color，卸载时恢复默认值
 * @param color - 页面主题色
 *
 * @example
 * ```tsx
 * import { useThemeColor, PAGE_THEME_COLORS } from '@/utils/themeColor';
 *
 * const MyPage = () => {
 *   useThemeColor(PAGE_THEME_COLORS.LIGHT_GRAY);
 *   return <div>...</div>;
 * };
 * ```
 */
export function useThemeColor(color: string): void {
  if (typeof window === 'undefined') return;

  React.useEffect(() => {
    // 保存当前颜色
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const previousColor = metaThemeColor?.getAttribute('content') || PAGE_THEME_COLORS.WHITE;

    // 设置新颜色
    setThemeColor(color);

    // 组件卸载时恢复默认颜色
    return () => {
      setThemeColor(previousColor);
    };
  }, [color]);
}

// React 依赖（由于这个文件会在多个地方使用，我们需要导入 React）
import React from 'react';
