'use server';

import { backendFetch } from '../../../lib/backend';

export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SpecializationSuggestion {
  id: string;
  university: {
    id: string;
    name: string;
    state: string;
    city: string | null;
    isActive: boolean;
  };
  /** The degree key the college's list is kept under, e.g. "MD/MS". */
  degree: string;
  name: string;
  status: SuggestionStatus;
  /** How many mentors entered this for this college. */
  submissionCount: number;
  createdAt: string;
  reviewedAt: string | null;
  /** Only on an approval: the college was inactive and is now published. */
  collegeActivated?: boolean;
}

type Page = { data: SpecializationSuggestion[]; nextCursor: string | null };

/** One page of suggestions for one status tab, most-requested first. */
export async function loadSuggestions(
  status: SuggestionStatus,
  cursor?: string,
): Promise<Page> {
  const params = new URLSearchParams({ status, limit: '50' });
  if (cursor) params.set('cursor', cursor);
  return backendFetch<Page>(`/admin/specialization-suggestions?${params.toString()}`);
}

export type ReviewResult =
  | { ok: true; suggestion: SpecializationSuggestion }
  | { ok: false; error: string };

/** Approve (adds it to the college's list, publishing the college if it is
 * still inactive), reject, or put back to pending. `name` optionally fixes the
 * spelling at the same time. */
export async function reviewSuggestion(
  id: string,
  status: SuggestionStatus,
  name?: string,
): Promise<ReviewResult> {
  try {
    const suggestion = await backendFetch<SpecializationSuggestion>(
      `/admin/specialization-suggestions/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(name ? { name } : {}) }),
      },
    );
    return { ok: true, suggestion };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update the suggestion',
    };
  }
}
