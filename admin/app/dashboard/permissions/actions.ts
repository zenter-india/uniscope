'use server';

import { revalidatePath } from 'next/cache';
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
}

export interface UserPermissions {
  user: PermissionUser;
  permissions: PermissionItem[];
}

type SaveResult = { ok: true; data: UserPermissions } | { ok: false; error: string };

export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  return backendFetch<UserPermissions>(`/admin/user-permissions/${userId}`);
}

/** Saves the complete list of revoked permission keys for the user. */
export async function saveUserPermissions(userId: string, denied: string[]): Promise<SaveResult> {
  try {
    const data = await backendFetch<UserPermissions>(`/admin/user-permissions/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ denied }),
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
