import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized Supabase Client
let supabaseClient: SupabaseClient | null = null;

function sanitizeSupabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  let cleaned = rawUrl.trim();
  // Strip trailing /rest/v1 or /rest/v1/ if user or env configured the REST endpoint directly
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  // Strip trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const rawUrl = process.env.SUPABASE_URL || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 
              process.env.SUPABASE_ANON_KEY || 
              (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY : undefined);

  const url = sanitizeSupabaseUrl(rawUrl);

  if (url && key && url !== 'https://your-project.supabase.co' && (url.startsWith('http://') || url.startsWith('https://'))) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false
        }
      });
      console.log('✅ Supabase client successfully initialized for El-Mallah Seafood at', url);
    } catch (e) {
      console.warn('⚠️ Failed to initialize Supabase client:', e);
    }
  }
  return supabaseClient;
}
