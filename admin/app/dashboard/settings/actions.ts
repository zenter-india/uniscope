'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

export interface Setting {
  key: string;
  label: string;
  description: string;
  unit: string;
  value: number;
  default: number;
  min: number;
  max: number;
  isDefault: boolean;
}

export async function getSettings(): Promise<Setting[]> {
  return backendFetch<Setting[]>('/admin/settings');
}

type SaveResult = { ok: true; settings: Setting[] } | { ok: false; error: string };

export async function updateSettings(
  updates: Record<string, number>,
): Promise<SaveResult> {
  try {
    const settings = await backendFetch<Setting[]>('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    revalidatePath('/dashboard/settings');
    return { ok: true, settings };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not save settings',
    };
  }
}
