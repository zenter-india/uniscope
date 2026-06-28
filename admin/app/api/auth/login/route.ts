import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE } from '../../../../lib/session';

export async function POST(request: Request) {
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

  if (email !== adminEmail || password !== adminPassword) {
    return NextResponse.json(
      { message: 'Invalid email or password.' },
      { status: 401 },
    );
  }

  const token = await createSessionToken(adminEmail, secret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return response;
}
