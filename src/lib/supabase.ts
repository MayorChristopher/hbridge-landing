import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

const supabaseUrl: string =
  Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://vapoyosssxnprxznnfgb.supabase.co';

const supabaseAnonKey: string =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhcG95b3Nzc3hucHJ4em5uZmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNTM3MDgsImV4cCI6MjA4MTkyOTcwOH0.kM-qHB-K4xU0pFsh2_Eb2MlZf9gG9diD-0TGNxIaceM';

// Enhanced storage with error handling
const storage = Platform.OS === 'web' ? {
  getItem: (key: string) => {
    try { 
      return Promise.resolve(localStorage.getItem(key)); 
    } catch (error) { 
      console.warn('[Storage] getItem failed:', error);
      return Promise.resolve(null); 
    }
  },
  setItem: (key: string, value: string) => {
    try { 
      localStorage.setItem(key, value); 
    } catch (error) {
      console.warn('[Storage] setItem failed:', error);
    }
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    try { 
      localStorage.removeItem(key); 
    } catch (error) {
      console.warn('[Storage] removeItem failed:', error);
    }
    return Promise.resolve();
  },
} : {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn('[AsyncStorage] getItem failed:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn('[AsyncStorage] setItem failed:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn('[AsyncStorage] removeItem failed:', error);
    }
  },
};

// Fetch with timeout only — do NOT override headers (breaks PostgREST GET requests)
const enhancedFetch = async (...args: Parameters<typeof fetch>) => {
  const [url, options = {}] = args;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      // Do NOT set Content-Type here — Supabase sets it correctly per request
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please check your internet connection');
    }
    console.warn('[Supabase] fetch failed:', error?.message);
    throw error;
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: {
    fetch: enhancedFetch,
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
