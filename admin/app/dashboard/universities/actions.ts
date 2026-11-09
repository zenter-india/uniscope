'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';
import type { UniversityRowData } from './UniversityRow';

export interface UniversityListFilters {
  search?: string;
  /** Only colleges offering this course (a program name, e.g. "MD/MS"). */
  course?: string;
  /** 'name' = Alphabet A–Z, 'name_desc' = Z–A, 'new' = newest first. */
  sort?: 'name' | 'name_desc' | 'new';
}

/** Next page of the admin university list — same filters as the page, plus a
 * cursor. Drives the infinite scroll in UniversitiesList. */
export async function loadMoreUniversities(
  filters: UniversityListFilters,
  cursor: string,
): Promise<{ data: UniversityRowData[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: '50', cursor });
  if (filters.search) params.set('search', filters.search);
  if (filters.course) params.set('course', filters.course);
  if (filters.sort === 'name' || filters.sort === 'name_desc') params.set('sort', filters.sort);

  return backendFetch<{ data: UniversityRowData[]; nextCursor: string | null }>(
    `/universities/admin/list?${params.toString()}`,
  );
}

export interface CollegeOption {
  id: string;
  name: string;
  district?: string | null;
  city: string | null;
  state: string;
}

/** One page (50, the backend's max) of active colleges from our DB matching
 * `query` (name, district or state), A–Z. Pass the returned `nextCursor` back
 * as `cursor` to get the following page — the picker keeps asking as the
 * admin scrolls, so there is no cap on how many colleges can be reached. */
export async function searchColleges(
  query: string,
  cursor?: string | null,
): Promise<{ data: CollegeOption[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: '50', sort: 'name', activeOnly: 'true' });
  if (query.trim()) params.set('search', query.trim());
  if (cursor) params.set('cursor', cursor);
  const page = await backendFetch<{
    data: CollegeOption[];
    nextCursor: string | null;
  }>(`/universities/admin/list?${params.toString()}`);
  return {
    data: page.data.map(({ id, name, district, city, state }) => ({
      id,
      name,
      district,
      city,
      state,
    })),
    nextCursor: page.nextCursor,
  };
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
  district?: string | null;
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
