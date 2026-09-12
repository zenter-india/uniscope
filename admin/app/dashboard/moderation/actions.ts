'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';
import type { ReportRowData } from './ReportRow';

export interface ReportListFilters {
  status: string;
  /** Reports filed by this user — "Reports filed by user" link on user
   * detail. */
  reporterId?: string;
  /** Reports directly targeting this user — "Reports against user" link on
   * user detail. */
  targetUserId?: string;
}

/** Next page of the reports list for the given filters. Drives the "Load
 * more" button in ReportsList. */
export async function loadMoreReports(
  filters: ReportListFilters,
  cursor: string,
): Promise<{ data: ReportRowData[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: '50', cursor });
  if (filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.reporterId) params.set('reporterId', filters.reporterId);
  if (filters.targetUserId) params.set('targetUserId', filters.targetUserId);
  return backendFetch<{ data: ReportRowData[]; nextCursor: string | null }>(
    `/reports?${params.toString()}`,
  );
}

export async function resolveReport(
  reportId: string,
  status: 'RESOLVED' | 'DISMISSED',
  resolution?: string,
  refundAmountMinor?: number,
): Promise<void> {
  await backendFetch(`/reports/${reportId}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      ...(resolution && { resolution }),
      ...(refundAmountMinor && { refundAmountMinor }),
    }),
  });
  revalidatePath('/dashboard/moderation');
  revalidatePath('/dashboard');
}
