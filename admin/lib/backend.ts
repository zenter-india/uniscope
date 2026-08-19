// Server-only bridge to the NestJS backend's ADMIN-guarded endpoints.
//
// The admin panel has its own self-contained login (see session.ts) that
// has nothing to do with the backend's User/JWT system. To call endpoints
// guarded by @Roles(ADMIN) we mint a short-lived JWT here that matches the
// exact format backend's TokenService.issueTokenPair produces (HS256,
// {sub, role} payload, signed with the same secret) for the one seeded
// ADMIN User row — see ADMIN_PANEL_USER_ID in .env.local. The backend's
// JwtStrategy trusts the signature alone; it never re-verifies the sub
// against the DB (see auth/strategies/jwt.strategy.ts), so this is safe as
// long as BACKEND_JWT_SECRET is never exposed to the client.
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonBase64Url(value: unknown): string {
  return toBase64Url(encoder.encode(JSON.stringify(value)));
}

async function signBackendJwt(): Promise<string> {
  const secret = process.env.BACKEND_JWT_SECRET;
  const sub = process.env.ADMIN_PANEL_USER_ID;
  if (!secret || !sub) {
    throw new Error(
      'BACKEND_JWT_SECRET / ADMIN_PANEL_USER_ID are not configured in admin/.env.local',
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = jsonBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = jsonBase64Url({
    sub,
    role: 'ADMIN',
    iat: nowSeconds,
    exp: nowSeconds + 300, // 5 minutes — minted fresh per request, never persisted
  });
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  const signature = toBase64Url(new Uint8Array(sig));

  return `${signingInput}.${signature}`;
}

export class BackendApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Server-only fetch against the backend API, authenticated as the seeded
 * admin user. Never call this from client components. */
export async function backendFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = process.env.BACKEND_API_URL;
  if (!baseUrl) {
    throw new Error('BACKEND_API_URL is not configured in admin/.env.local');
  }

  const token = await signBackendJwt();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new BackendApiError(res.status, body || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Same auth/base-URL handling as backendFetch, but for a non-JSON response
 * (e.g. the CSV export) — reads the body as text instead of parsing JSON. */
export async function backendFetchText(path: string): Promise<string> {
  const baseUrl = process.env.BACKEND_API_URL;
  if (!baseUrl) {
    throw new Error('BACKEND_API_URL is not configured in admin/.env.local');
  }

  const token = await signBackendJwt();
  const res = await fetch(`${baseUrl}${path}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new BackendApiError(res.status, body || res.statusText);
  }

  return res.text();
}
