/**
 * Umami Analytics 工具函数
 * 
 * 提供类型安全的 Umami API 访问，用于用户追踪和事件跟踪。
 */

// Umami 全局对象类型定义
declare global {
  interface Window {
    umami?: {
      identify: (data: { userId: string; [key: string]: any }) => void;
      track: (eventName: string, eventData?: Record<string, any>) => void;
    };
  }
}

/**
 * 识别已登录用户（用于 Umami 用户追踪）
 * 
 * @param userId - 用户唯一标识符（Supabase UUID）
 */
export function identifyUser(userId: string): void {
  if (typeof window === 'undefined') return;
  
  if (!window.umami) {
    console.debug('[Umami] Script not loaded yet, skipping identify');
    return;
  }

  try {
    window.umami.identify({
      userId,
    });
    console.debug('[Umami] User identified:', userId);
  } catch (error) {
    console.error('[Umami] Failed to identify user:', error);
  }
}

/**
 * 追踪自定义事件
 * 
 * @param eventName - 事件名称
 * @param eventData - 事件数据（可选）
 */
export function trackEvent(eventName: string, eventData?: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  
  if (!window.umami) {
    console.debug('[Umami] Script not loaded yet, skipping track');
    return;
  }

  try {
    window.umami.track(eventName, eventData);
    console.debug('[Umami] Event tracked:', eventName, eventData);
  } catch (error) {
    console.error('[Umami] Failed to track event:', error);
  }
}

/**
 * 检查 Umami 是否已加载
 */
export function isUmamiLoaded(): boolean {
  return typeof window !== 'undefined' && !!window.umami;
}
