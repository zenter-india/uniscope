'use server';

import { backendFetch } from '../../../lib/backend';

export type CustomDegreeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CustomDegree {
  id: string;
  stream: string;
  name: string;
  status: CustomDegreeStatus;
  /** How many times people have typed this exact degree. */
  submissionCount: number;
  createdAt: string;
  reviewedAt: string | null;
}

type Page = { data: CustomDegree[]; nextCursor: string | null };

/** One page of degrees users typed under "Others", for one status tab. */
export async function loadCustomDegrees(
  status: CustomDegreeStatus,
  cursor?: string,
): Promise<Page> {
  const params = new URLSearchParams({ status, limit: '50' });
  if (cursor) params.set('cursor', cursor);
  return backendFetch<Page>(`/admin/custom-degrees?${params.toString()}`);
}

export type ReviewResult =
  | { ok: true; degree: CustomDegree }
  | { ok: false; error: string };

/** Approve / reject / put back to pending. `name` optionally fixes the
 * spelling or casing at the same time (what users then see as the chip). */
export async function reviewCustomDegree(
  id: string,
  status: CustomDegreeStatus,
  name?: string,
): Promise<ReviewResult> {
  try {
    const degree = await backendFetch<CustomDegree>(
      `/admin/custom-degrees/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(name ? { name } : {}) }),
      },
    );
    return { ok: true, degree };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update the degree',
    };
  }
}
