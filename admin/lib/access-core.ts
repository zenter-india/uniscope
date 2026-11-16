// Looks up what an admin may do. Runs on both the server and the middleware
// (it only uses fetch + the backend bridge), so it must not import anything
// that needs the Node runtime or next/headers.
import { backendFetch } from './backend';
import { FULL_ACCESS, NO_ACCESS, type Access } from './permissions';

interface AccessResponse {
  exists: boolean;
  isActive: boolean;
  fullAccess: boolean;
  permissions: string[];
}

/** The root env login is not a database row and always has full access. */
export function isRootEmail(email: string): boolean {
  const root = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  return !!root && email.trim().toLowerCase() === root;
}

/** What this admin may do right now, or null when it could not be looked up
 * (backend unreachable) — callers decide how to treat that. A deactivated or
 * removed account gets no access at all. */
export async function lookupAccess(email: string): Promise<Access | null> {
  if (isRootEmail(email)) return FULL_ACCESS;
  try {
    const res = await backendFetch<AccessResponse>(
      `/admin/admin-accounts/access?email=${encodeURIComponent(email)}`,
    );
    if (!res.exists || !res.isActive) return NO_ACCESS;
    return { fullAccess: res.fullAccess, permissions: res.permissions };
  } catch {
    return null;
  }
}
