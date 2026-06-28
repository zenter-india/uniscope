import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './lib/session';

export async function middleware(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? '';
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const email = await verifySessionToken(token, secret);

  if (!email) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
