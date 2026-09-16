/**
 * Secure server-to-server client for the Almallah Admin backend.
 *
 * ADMIN_API_BASE_URL is the Admin public API base URL.
 * ADMIN_INTEGRATION_KEY is server-only and MUST NEVER reach the browser.
 */

const DEFAULT_TIMEOUT_MS = 10000;

export function getAdminBaseUrl(): string {
  const value = process.env.ADMIN_API_BASE_URL?.trim();

  if (!value) {
    throw new Error('ADMIN_API_BASE_URL is not configured');
  }

  return value.replace(/\/+$/, '');
}

function getIntegrationKey(): string {
  const value = process.env.ADMIN_INTEGRATION_KEY?.trim();

  if (!value) {
    throw new Error('ADMIN_INTEGRATION_KEY is not configured');
  }

  return value;
}

async function requestAdmin<T>(
  path: string,
  options: RequestInit = {},
  requireIntegrationKey = false
): Promise<T> {
  const baseUrl = getAdminBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (requireIntegrationKey) {
      headers.set('X-Integration-Key', getIntegrationKey());
    }

    const response = await fetch(`${baseUrl}/${path.replace(/^\/+/, '')}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload && typeof payload.error === 'string'
          ? payload.error
          : `Admin API request failed with status ${response.status}`;

      const error = new Error(message) as Error & { status?: number; payload?: unknown };
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function adminPublicGet<T>(path: string): Promise<T> {
  return requestAdmin<T>(path, { method: 'GET' }, false);
}

export function adminPublicPost<T>(path: string, body: unknown): Promise<T> {
  return requestAdmin<T>(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    false
  );
}

export function adminIntegrationGet<T>(path: string): Promise<T> {
  return requestAdmin<T>(path, { method: 'GET' }, true);
}

export function adminIntegrationPost<T>(path: string, body: unknown): Promise<T> {
  return requestAdmin<T>(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    true
  );
}

/**
 * Open the admin3 session-scoped SSE stream. No integration key is used here:
 * authorization is the unguessable payment-session capability token.
 */
export async function openAdminPaymentEventStream(
  sessionId: string,
  clientToken: string,
  signal: AbortSignal
): Promise<Response> {
  const baseUrl = getAdminBaseUrl();
  const url = new URL(`${baseUrl}/payments/sessions/${encodeURIComponent(sessionId)}/events`);
  url.searchParams.set('token', clientToken);

  return fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
    signal,
  });
}
