import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from './session';

/** Server-only: the signed-in admin's email, or null. Middleware already
 * guarantees a valid session for anything under /dashboard — this is just
 * for display. */
export async function getAdminEmail(): Promise<string | null> {
  const secret = process.env.ADMIN_SESSION_SECRET ?? '';
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, secret);
}
