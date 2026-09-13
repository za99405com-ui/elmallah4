import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * SERVER-ONLY Supabase Admin Client
 * 
 * SECURITY RULES:
 * 1. Uses SUPABASE_SERVICE_ROLE_KEY only.
 * 2. NEVER falls back to an anonymous key.
 * 3. NEVER import this file into browser/client bundle.
 * 4. Fails clearly if required server credentials are missing.
 */

let serverClient: SupabaseClient | null = null;

function sanitizeUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  let cleaned = rawUrl.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export function getServerSupabase(): SupabaseClient | null {
  if (serverClient) return serverClient;

  const rawUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceKey) {
    return null;
  }

  const url = sanitizeUrl(rawUrl);
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return null;
  }

  try {
    serverClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    return serverClient;
  } catch (err) {
    console.error('[Server Supabase] Failed to initialize service role client:', err);
    return null;
  }
}
