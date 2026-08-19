'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

export async function getLeadDocumentUrl(leadId: string): Promise<string> {
  const { url } = await backendFetch<{ url: string }>(`/enrollments/${leadId}/document-url`);
  return url;
}

export async function updateLead(
  leadId: string,
  patch: { status?: string; adminNote?: string },
): Promise<void> {
  await backendFetch(`/enrollments/${leadId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  revalidatePath('/dashboard/leads');
  revalidatePath('/dashboard');
}
