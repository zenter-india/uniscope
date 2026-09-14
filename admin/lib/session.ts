// Minimal stateless admin session: an HMAC-signed cookie value.
// Self-contained to the admin app — no external auth provider, no backend call.
// Works in both the Node (route handlers) and Edge (middleware) runtimes using
// only Web Crypto + btoa/atob.

export const SESSION_COOKIE = 'admin_session';

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function utf8Base64Url(value: string): string {
  return toBase64Url(encoder.encode(value));
}

function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(sig));
}

/** Must match the cookie's own maxAge in the login route — the token's
 * embedded expiry is the one that's actually enforced server-side; the
 * cookie's maxAge is only a browser-side hint that a leaked raw token string
 * can't be bound by. */
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

/** Build a tamper-resistant, time-limited session token for the given admin
 * email. Encodes `{email, exp}` so a copied/leaked token stops verifying on
 * its own once `exp` passes, instead of being valid forever until the
 * shared secret is rotated. */
export async function createSessionToken(
  email: string,
  secret: string,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = utf8Base64Url(JSON.stringify({ email, exp }));
  const sig = await sign(payload, secret);
  return `${payload}.${sig}`;
}

/** Return the email if the token's signature is valid for the secret AND it
 * hasn't expired, else null. A pre-expiry-claim token (signed before this
 * change) fails JSON.parse and is treated as invalid — forcing a fresh
 * login, which is the desired behavior since those tokens never expired. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = await sign(payload, secret);
  if (expected !== sig) return null;
  try {
    const decoded = JSON.parse(fromBase64Url(payload)) as {
      email?: string;
      exp?: number;
    };
    if (!decoded.email || typeof decoded.exp !== 'number') return null;
    if (Date.now() / 1000 >= decoded.exp) return null;
    return decoded.email;
  } catch {
    return null;
  }
}
