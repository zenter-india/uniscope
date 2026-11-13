'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

export interface AdminAccount {
  id: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  fullAccess: boolean;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; account: AdminAccount } | { ok: false; error: string };

export async function getAdminAccounts(): Promise<AdminAccount[]> {
  return backendFetch<AdminAccount[]>('/admin/admin-accounts');
}

export async function createAdminAccount(input: {
  email: string;
  password: string;
  displayName?: string;
  fullAccess: boolean;
  permissions: string[];
}): Promise<CreateResult> {
  try {
    const account = await backendFetch<AdminAccount>('/admin/admin-accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/dashboard/admins');
    return { ok: true, account };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not create the admin account' };
  }
}

export async function setAdminAccountActive(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    await backendFetch(`/admin/admin-accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
    revalidatePath('/dashboard/admins');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not update the admin account' };
  }
}

export async function resetAdminAccountPassword(id: string, password: string): Promise<ActionResult> {
  try {
    await backendFetch(`/admin/admin-accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
    revalidatePath('/dashboard/admins');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not reset the password' };
  }
}

/** Saves what an admin may open and change (replaces the stored list). */
export async function updateAdminAccountPermissions(
  id: string,
  input: { fullAccess: boolean; permissions: string[] },
): Promise<{ ok: true; account: AdminAccount } | { ok: false; error: string }> {
  try {
    const account = await backendFetch<AdminAccount>(`/admin/admin-accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    revalidatePath('/dashboard/admins');
    return { ok: true, account };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save the permissions' };
  }
}
