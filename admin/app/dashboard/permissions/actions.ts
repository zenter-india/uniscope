'use server';

import { revalidatePath } from 'next/cache';
import { getAdminEmail } from '../../../lib/adminAuth';
import { backendFetch } from '../../../lib/backend';

export interface PermissionUser {
  id: string;
  displayName: string;
  uniqueId: string | null;
  role: string;
}

export interface PermissionItem {
  key: string;
  label: string;
  description: string;
  allowed: boolean;
  /** Set only while denied. */
  deniedAt: string | null;
  deniedBy: string | null;
  reason: string | null;
}

export interface PermissionEvent {
  permission: string;
  label: string;
  action: 'DENY' | 'ALLOW';
  adminEmail: string | null;
  reason: string | null;
  at: string;
}

export interface UserPermissions {
  user: PermissionUser;
  permissions: PermissionItem[];
  history: PermissionEvent[];
}

type SaveResult = { ok: true; data: UserPermissions } | { ok: false; error: string };

export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  return backendFetch<UserPermissions>(`/admin/user-permissions/${userId}`);
}

/** Saves the complete list of revoked permission keys for the user. `reason`
 * is required when something is newly denied; the signed-in admin's email is
 * recorded with the change. */
export async function saveUserPermissions(
  userId: string,
  denied: string[],
  reason: string,
): Promise<SaveResult> {
  try {
    const adminEmail = await getAdminEmail();
    const data = await backendFetch<UserPermissions>(`/admin/user-permissions/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ denied, reason, adminEmail }),
    });
    revalidatePath('/dashboard/permissions');
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save permissions' };
  }
}

/** App users (aspirants/mentors) matching a name or ID. Admin accounts are filtered out. */
export async function searchPermissionUsers(search: string): Promise<PermissionUser[]> {
  const params = new URLSearchParams({ limit: '15', search });
  const res = await backendFetch<{
    data: { id: string; displayName: string; role: string; uniqueId?: string | null }[];
  }>(`/users?${params.toString()}`);
  return res.data
    .filter((u) => u.role !== 'ADMIN')
    .map((u) => ({
      id: u.id,
      displayName: u.displayName,
      role: u.role,
      uniqueId: u.uniqueId ?? null,
    }));
}
