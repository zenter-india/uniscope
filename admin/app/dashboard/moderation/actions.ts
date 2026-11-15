'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';
import type { ReportRowData } from './ReportRow';

/** Next page of the reports list for a given status. Drives the "Load more"
 * button in ReportsList. */
export async function loadMoreReports(
  status: string,
  cursor: string,
): Promise<{ data: ReportRowData[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ status, limit: '50', cursor });
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
