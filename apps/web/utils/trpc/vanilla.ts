/**
 * tRPC vanilla client（非 React 环境用）。
 * 用于 heartbeat manager、invite handler 等不在 React 组件树中的模块。
 */
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@evobook/api/src/root-router';
import { supabase } from '../supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const trpcVanilla = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/trpc`,
      async headers() {
        const headers: Record<string, string> = {
          'Accept-Language': navigator.language || 'en',
        };
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        } catch {
          // 获取 token 失败时继续
        }
        return headers;
      },
    }),
  ],
});
