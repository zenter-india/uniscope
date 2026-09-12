'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

export interface ModeratedReview {
  id: string;
  kind: 'mentor' | 'university';
  status: 'ACTIVE' | 'HIDDEN' | 'REMOVED';
  rating: number;
  text: string | null;
  authorId: string;
  authorName: string;
  subjectId: string;
  subjectName: string;
  createdAt: string;
}

export interface ReviewFilters {
  type: 'mentor' | 'university';
  status?: string;
  search?: string;
  sort?: string;
  dir?: string;
  /** Reviews written by this user — "Reviews filed" link on user detail. */
  authorId?: string;
  /** Reviews *about* this user (mentor reviews only) — "Mentor reviews
   * received" link on user detail. */
  subjectId?: string;
}

export async function loadMoreReviews(
  filters: ReviewFilters,
  cursor: string,
): Promise<{ data: ModeratedReview[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ type: filters.type, limit: '20', cursor });
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.authorId) params.set('authorId', filters.authorId);
  if (filters.subjectId) params.set('subjectId', filters.subjectId);
  if (filters.sort) params.set('sortBy', filters.sort);
  if (filters.dir) params.set('sortDir', filters.dir);

  return backendFetch<{ data: ModeratedReview[]; nextCursor: string | null }>(
    `/admin/reviews?${params.toString()}`,
  );
}

type Result = { ok: true } | { ok: false; error: string };

/** Set a review's moderation status. `kind` picks the endpoint. */
export async function setReviewStatus(
  kind: 'mentor' | 'university',
  id: string,
  status: 'ACTIVE' | 'HIDDEN' | 'REMOVED',
): Promise<Result> {
  try {
    await backendFetch(`/admin/reviews/${kind}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    revalidatePath('/dashboard/reviews');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update the review',
    };
  }
}

type BulkResult = { ok: true; updated: number } | { ok: false; error: string };

/** Bulk moderation — e.g. hide a batch of spam reviews at once. All ids in
 * one call must be the same `kind` (the list only ever shows one at a time,
 * via the type filter tab). */
export async function bulkSetReviewStatus(
  kind: 'mentor' | 'university',
  ids: string[],
  status: 'ACTIVE' | 'HIDDEN' | 'REMOVED',
): Promise<BulkResult> {
  try {
    const res = await backendFetch<{ updated: number }>('/admin/reviews/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ kind, ids, status }),
    });
    revalidatePath('/dashboard/reviews');
    return { ok: true, updated: res.updated };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update the selected reviews',
    };
  }
}
