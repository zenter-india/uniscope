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
