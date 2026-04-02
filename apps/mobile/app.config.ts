import 'dotenv/config';

export default {
  expo: {
    name: 'EvoBook',
    slug: 'evobook',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    scheme: 'evobook',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain' as const,
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.evobook.app',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.evobook.app',
    },
    plugins: ['expo-router', 'expo-secure-store'],
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8002',
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://slvwclfywvlpwfwlforw.supabase.co',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_YfPuZvwtREQO1tcTUXyEug_iLO9oLgK',
    },
  },
};
