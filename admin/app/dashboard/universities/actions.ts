'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';
import type { UniversityRowData } from './UniversityRow';

export interface UniversityListFilters {
  search?: string;
}

/** Next page of the admin university list — same filters as the page, plus a
 * cursor. Drives the "Load more" button in UniversitiesList. */
export async function loadMoreUniversities(
  filters: UniversityListFilters,
  cursor: string,
): Promise<{ data: UniversityRowData[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: '50', cursor });
  if (filters.search) params.set('search', filters.search);

  return backendFetch<{ data: UniversityRowData[]; nextCursor: string | null }>(
    `/universities/admin/list?${params.toString()}`,
  );
}

export interface UniversityInput {
  name: string;
  stream?: string;
  state: string;
  city: string | null;
  establishedYear?: number;
  website?: string;
  description?: string;
}

export async function createUniversity(input: UniversityInput): Promise<void> {
  await backendFetch('/universities', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  revalidatePath('/dashboard/universities');
}

export async function updateUniversity(
  id: string,
  input: Partial<UniversityInput> & { isActive?: boolean },
): Promise<void> {
  await backendFetch(`/universities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  revalidatePath('/dashboard/universities');
}

export async function uploadUniversityPhoto(id: string, imageBase64: string): Promise<void> {
  await backendFetch(`/universities/${id}/photo`, {
    method: 'POST',
    body: JSON.stringify({ imageBase64 }),
  });
  revalidatePath('/dashboard/universities');
}

export interface DuplicateUniversity {
  id: string;
  name: string;
  slug: string;
  state: string;
  city: string | null;
  stream: string | null;
  establishedYear: number | null;
  isActive: boolean;
  createdAt: string;
  programCount: number;
  reviewCount: number;
}

export interface DuplicateGroup {
  key: string;
  state: string;
  universities: DuplicateUniversity[];
}

export async function loadDuplicateGroups(): Promise<DuplicateGroup[]> {
  return backendFetch<DuplicateGroup[]>('/universities/admin/duplicates');
}

export interface MergeResult {
  winnerId: string;
  deactivated: number;
  programsMoved: number;
  reviewsMoved: number;
  savedMoved: number;
  profilesMoved: number;
  verificationRequestsMoved: number;
  enrollmentLeadsMoved: number;
}

export type MergeUniversitiesResult =
  | { ok: true; result: MergeResult }
  | { ok: false; error: string };

export async function mergeUniversities(
  winnerId: string,
  loserIds: string[],
): Promise<MergeUniversitiesResult> {
  try {
    const result = await backendFetch<MergeResult>('/universities/admin/merge', {
      method: 'POST',
      body: JSON.stringify({ winnerId, loserIds }),
    });
    revalidatePath('/dashboard/universities');
    revalidatePath('/dashboard/universities/duplicates');
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not merge universities' };
  }
}
