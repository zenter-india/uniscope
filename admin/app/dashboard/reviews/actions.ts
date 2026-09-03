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
}

export async function loadMoreReviews(
  filters: ReviewFilters,
  cursor: string,
): Promise<{ data: ModeratedReview[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ type: filters.type, limit: '20', cursor });
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);

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
