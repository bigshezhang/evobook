import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '../utils/trpc';
import { supabase } from '../utils/supabase';
import { AuthProvider, useAuth } from '../utils/auth';
import { API_BASE_URL } from '../utils/constants';

function AuthNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login';
    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="generating" />
      <Stack.Screen name="course/[id]" />
      <Stack.Screen name="course/card" />
    </Stack>
  );
}

export default function RootLayout() {
  // React Query: app 从后台恢复时自动 refetch stale queries
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    });
    return () => sub.remove();
  }, []);

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,           // 数据立即标记为 stale
        refetchOnMount: true,   // 组件挂载时 refetch
        refetchOnWindowFocus: true, // 窗口获得焦点时 refetch
        retry: 1,
      },
    },
  }));

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${API_BASE_URL}/trpc`,
          async headers() {
            const headers: Record<string, string> = {};
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
              }
            } catch {}
            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <AuthNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
