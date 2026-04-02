import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const API_BASE_URL: string = extra.apiBaseUrl
  ?? (typeof __DEV__ !== 'undefined' && __DEV__ ? 'http://localhost:8002' : 'https://api.evobook.app');

export const SUPABASE_URL: string = extra.supabaseUrl
  ?? 'https://slvwclfywvlpwfwlforw.supabase.co';

export const SUPABASE_ANON_KEY: string = extra.supabaseAnonKey
  ?? 'sb_publishable_YfPuZvwtREQO1tcTUXyEug_iLO9oLgK';
