'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';
import type { UserRowData } from './UserRow';

export async function setUserBanned(userId: string, banned: boolean): Promise<void> {
  await backendFetch(`/users/${userId}/ban`, {
    method: 'PATCH',
    body: JSON.stringify({ banned }),
  });
  revalidatePath('/dashboard/users');
}

type BulkResult = { ok: true; updated: number } | { ok: false; error: string };

/** Bulk ban/unban — see UsersService.bulkSetBanned. ADMIN accounts are
 * silently excluded server-side, same as the single-user route refuses one. */
export async function bulkSetUsersBanned(ids: string[], banned: boolean): Promise<BulkResult> {
  try {
    const res = await backendFetch<{ updated: number }>('/users/bulk-ban', {
      method: 'PATCH',
      body: JSON.stringify({ ids, banned }),
    });
    revalidatePath('/dashboard/users');
    return { ok: true, updated: res.updated };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update the selected users',
    };
  }
}

export interface UserListFilters {
  role?: string;
  search?: string;
  verificationStatus?: string;
  banned?: boolean;
  sort?: string;
  dir?: string;
}

/** Next page of the admin user list — same filters as the page, plus a cursor.
 * Drives the "Load more" button in UsersList. */
export async function loadMoreUsers(
  filters: UserListFilters,
  cursor: string,
): Promise<{ data: UserRowData[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: '50', cursor });
  if (filters.role && filters.role !== 'ALL') params.set('role', filters.role);
  if (filters.search) params.set('search', filters.search);
  if (filters.verificationStatus && filters.verificationStatus !== 'ALL') {
    params.set('verificationStatus', filters.verificationStatus);
  }
  if (filters.banned) params.set('isBanned', 'true');
  if (filters.sort) params.set('sortBy', filters.sort);
  if (filters.dir) params.set('sortDir', filters.dir);

  return backendFetch<{ data: UserRowData[]; nextCursor: string | null }>(
    `/users?${params.toString()}`,
  );
}
