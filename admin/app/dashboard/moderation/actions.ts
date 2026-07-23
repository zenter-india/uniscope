'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

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
