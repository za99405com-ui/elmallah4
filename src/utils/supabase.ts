import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * PUBLIC / BROWSER Supabase Client
 * 
 * SECURITY RULES:
 * 1. Uses public anonymous keys only (VITE_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY).
 * 2. NEVER references or falls back to SUPABASE_SERVICE_ROLE_KEY.
 * 3. Safe to be bundled into the client-side application.
 */
let publicSupabaseClient: SupabaseClient | null = null;

function sanitizeSupabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  let cleaned = rawUrl.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export function getSupabase(): SupabaseClient | null {
  if (publicSupabaseClient) return publicSupabaseClient;

  // Use public client variables only
  const rawUrl = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined) ||
                 process.env.VITE_SUPABASE_URL ||
                 process.env.SUPABASE_URL;

  const anonKey = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY : undefined) ||
                  process.env.VITE_SUPABASE_ANON_KEY ||
                  process.env.SUPABASE_ANON_KEY;

  const url = sanitizeSupabaseUrl(rawUrl);

  if (url && anonKey && url !== 'https://your-project.supabase.co' && (url.startsWith('http://') || url.startsWith('https://'))) {
    try {
      publicSupabaseClient = createClient(url, anonKey, {
        auth: {
          persistSession: false
        }
      });
    } catch (e) {
      console.warn('⚠️ Public Supabase client initialization notice:', e);
    }
  }
  return publicSupabaseClient;
}

