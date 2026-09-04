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

type SaveResult = { ok: true } | { ok: false; error: string };

/** GDPR erasure — irreversibly anonymizes the account. The user row stays
 * (financial/counterparty records depend on it) but every personal-data
 * field is wiped and the phone hash is scrambled so it can't be recovered. */
export async function eraseUser(userId: string): Promise<SaveResult> {
  try {
    await backendFetch(`/users/${userId}/erase`, { method: 'POST' });
    revalidatePath(`/dashboard/users/${userId}`);
    revalidatePath('/dashboard/users');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not erase the account',
    };
  }
}

/** Admin edit of a user's profile / role / verification / free-tier fields.
 * `patch` carries only the changed fields. Returns the failure reason rather
 * than throwing so it can be shown in the form. */
export async function updateUserProfile(
  userId: string,
  patch: Record<string, unknown>,
): Promise<SaveResult> {
  try {
    await backendFetch(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath(`/dashboard/users/${userId}`);
    revalidatePath('/dashboard/users');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not save the changes',
    };
  }
}

/** Short-lived signed URL for a verification document, by request id. Reuses
 * the same ADMIN endpoint the Verification Queue uses. */
export async function getVerificationDocumentUrl(requestId: string): Promise<string> {
  const { url } = await backendFetch<{ url: string }>(
    `/verification/${requestId}/document-url`,
  );
  return url;
}

export interface LedgerEntryData {
  id: string;
  type: string;
  amountMinor: number;
  balanceAfterMinor: number;
  sessionId: string | null;
  note: string | null;
  createdAt: string;
}

export interface LedgerPage {
  balanceMinor: number;
  data: LedgerEntryData[];
  nextCursor: string | null;
}

/** Next page of a user's wallet ledger. Drives the "Load more" in WalletPanel. */
export async function loadMoreLedger(
  userId: string,
  cursor: string,
): Promise<{ data: LedgerEntryData[]; nextCursor: string | null }> {
  const { data, nextCursor } = await backendFetch<LedgerPage>(
    `/wallet/admin/${userId}/ledger?limit=15&cursor=${encodeURIComponent(cursor)}`,
  );
  return { data, nextCursor };
}

type AdjustResult =
  | { ok: true; balanceMinor: number }
  | { ok: false; error: string };

/** Manual wallet correction — writes an ADJUSTMENT ledger entry with the
 * reason as its note. `amountMinor` is signed (positive credits, negative
 * debits). Returns the failure reason instead of throwing. */
export async function adjustBalance(
  userId: string,
  amountMinor: number,
  reason: string,
): Promise<AdjustResult> {
  try {
    const wallet = await backendFetch<{ balanceMinor: number }>(
      `/wallet/admin/${userId}/adjust`,
      { method: 'POST', body: JSON.stringify({ amountMinor, reason }) },
    );
    revalidatePath(`/dashboard/users/${userId}`);
    return { ok: true, balanceMinor: wallet.balanceMinor };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not adjust the balance',
    };
  }
}
