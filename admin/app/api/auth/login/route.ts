import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { checkLoginRateLimit } from '../../../../lib/rateLimit';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from '../../../../lib/session';

/** Vercel always sets this on incoming requests; `x-real-ip` is a fallback
 * for other hosts. Falls back to a shared bucket only if neither header is
 * present at all (e.g. a local dev request with no proxy in front). */
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Constant-time string compare, safe even when the two inputs differ in
 * length (crypto.timingSafeEqual throws on that instead of just returning
 * false, so both sides are hashed to a fixed-length digest first). Used
 * only for the root env credential -- DB-backed accounts already go through
 * bcrypt.compare on the backend, which is constant-time by construction. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(request: Request) {
  const rateLimit = checkLoginRateLimit(clientIp(request));
  if (rateLimit.limited) {
    return NextResponse.json(
      { message: 'Too many attempts. Try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { email, password } = (await request
    .json()
    .catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!adminEmail || !adminPassword || !secret) {
    return NextResponse.json(
      { message: 'Admin auth is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SESSION_SECRET.' },
      { status: 500 },
    );
  }

  if (!email || !password) {
    return NextResponse.json({ message: 'Invalid email or password.' }, { status: 401 });
  }

  // The root ADMIN_EMAIL/ADMIN_PASSWORD pair is the un-removable bootstrap
  // credential -- checked first, entirely locally, so a DB-backed account
  // problem (migration not run, backend unreachable) can never lock this
  // out. It never reaches the backend at all.
  const isRoot = safeEqual(email, adminEmail) && safeEqual(password, adminPassword);

  let resolvedEmail: string | null = isRoot ? adminEmail : null;

  // Not the root pair -- check it against the DB-backed admin accounts
  // (see /dashboard/admins) via the backend's unauthenticated verify
  // endpoint. That route is itself rate-limited on the backend, same as
  // this app's only other unauthenticated writes.
  if (!resolvedEmail) {
    const baseUrl = process.env.BACKEND_API_URL;
    if (baseUrl) {
      try {
        const res = await fetch(`${baseUrl}/admin-accounts/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          cache: 'no-store',
        });
        if (res.ok) {
          const result = (await res.json()) as { ok?: boolean; email?: string };
          if (result.ok && result.email) resolvedEmail = result.email;
        }
      } catch {
        // Backend unreachable -- fall through to the generic 401 below.
        // The root credential path above is unaffected either way.
      }
    }
  }

  if (!resolvedEmail) {
    return NextResponse.json(
      { message: 'Invalid email or password.' },
      { status: 401 },
    );
  }

  const token = await createSessionToken(resolvedEmail, secret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS, // must match the token's own embedded exp — see lib/session.ts
  });
  return response;
}
