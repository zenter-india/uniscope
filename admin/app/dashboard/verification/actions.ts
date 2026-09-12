'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

export interface VerificationHistoryRowData {
  id: string;
  userId: string;
  userDisplayName?: string;
  userRole?: string;
  universityId: string;
  universityName?: string;
  documentType: string;
  status: string;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface VerificationHistoryFilters {
  status?: string;
  search?: string;
}

/** Resolved (VERIFIED/REJECTED) verification decisions — the admin history
 * tab, distinct from the pending queue. */
export async function loadMoreVerificationHistory(
  filters: VerificationHistoryFilters,
  cursor: string,
): Promise<{ data: VerificationHistoryRowData[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: '30', cursor });
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);

  return backendFetch<{ data: VerificationHistoryRowData[]; nextCursor: string | null }>(
    `/verification/history?${params.toString()}`,
  );
}

export async function getVerificationDocumentUrl(requestId: string): Promise<string> {
  const { url } = await backendFetch<{ url: string }>(
    `/verification/${requestId}/document-url`,
  );
  return url;
}

export async function reviewVerificationRequest(
  requestId: string,
  approve: boolean,
  note?: string,
): Promise<void> {
  await backendFetch(`/verification/${requestId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ approve, ...(note && { note }) }),
  });
  revalidatePath('/dashboard/verification');
  revalidatePath('/dashboard');
}

type BulkReviewResult =
  | { ok: true; reviewed: number; failed: { id: string; reason: string }[] }
  | { ok: false; error: string };

/** Bulk approve/reject — see VerificationService.bulkReview. Loops the
 * single-request review internally (it's a $transaction + notification),
 * so a partial failure is reported per-id rather than silently dropped. */
export async function bulkReviewVerificationRequests(
  ids: string[],
  approve: boolean,
  note?: string,
): Promise<BulkReviewResult> {
  try {
    const res = await backendFetch<{
      reviewed: number;
      failed: { id: string; reason: string }[];
    }>('/verification/bulk-review', {
      method: 'PATCH',
      body: JSON.stringify({ ids, approve, ...(note && { note }) }),
    });
    revalidatePath('/dashboard/verification');
    revalidatePath('/dashboard');
    return { ok: true, reviewed: res.reviewed, failed: res.failed };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not review the selected requests',
    };
  }
}
