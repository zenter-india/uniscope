import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { lookupAccess } from './lib/access-core';
import { NO_ACCESS_PATH, canOpenPath, type Access } from './lib/permissions';
import { SESSION_COOKIE, verifySessionToken } from './lib/session';

// The pages of a section are opened many times a second by link prefetching,
// so what an admin may do is remembered for a few seconds per server instance.
const ACCESS_TTL_MS = 5_000;
const cache = new Map<string, { at: number; access: Access | null }>();

async function accessFor(email: string): Promise<Access | null> {
  const hit = cache.get(email);
  if (hit && Date.now() - hit.at < ACCESS_TTL_MS) return hit.access;
  const access = await lookupAccess(email);
  cache.set(email, { at: Date.now(), access });
  if (cache.size > 200) cache.clear();
  return access;
}

export async function middleware(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? '';
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const email = await verifySessionToken(token, secret);

  if (!email) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const pathname = request.nextUrl.pathname;
  const access = await accessFor(email);
  if (!access || !canOpenPath(access, pathname)) {
    const url = new URL(NO_ACCESS_PATH, request.url);
    if (!access) url.searchParams.set('reason', 'unavailable');
    else url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // Tell the server code which page a request (or server action) came from,
  // so a write can be checked against that section's Edit permission.
  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
