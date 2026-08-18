import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    __TRICORD_RUNTIME_CONFIG__?: {
      VITE_SUPABASE_URL?: string;
      VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    };
  }
}

const runtimeConfig = typeof window === 'undefined' ? undefined : window.__TRICORD_RUNTIME_CONFIG__;
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || runtimeConfig?.VITE_SUPABASE_URL;
const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || runtimeConfig?.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;
