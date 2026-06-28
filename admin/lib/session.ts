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

/** Build a tamper-resistant session token for the given admin email. */
export async function createSessionToken(
  email: string,
  secret: string,
): Promise<string> {
  const payload = utf8Base64Url(email);
  const sig = await sign(payload, secret);
  return `${payload}.${sig}`;
}

/** Return the email if the token is valid for the secret, else null. */
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
    return fromBase64Url(payload);
  } catch {
    return null;
  }
}
