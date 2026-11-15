'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../../lib/backend';

export async function setUserBanned(userId: string, banned: boolean): Promise<void> {
  await backendFetch(`/users/${userId}/ban`, {
    method: 'PATCH',
    body: JSON.stringify({ banned }),
  });
  revalidatePath(`/dashboard/users/${userId}`);
  revalidatePath('/dashboard/users');
}

/** Short-lived signed URL for a verification document, by request id. Reuses
 * the same ADMIN endpoint the Verification Queue uses. */
export async function getVerificationDocumentUrl(requestId: string): Promise<string> {
  const { url } = await backendFetch<{ url: string }>(
    `/verification/${requestId}/document-url`,
  );
  return url;
}
