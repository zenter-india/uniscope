'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

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
