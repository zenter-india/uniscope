'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

type Result = { ok: true } | { ok: false; error: string };

/** Move a payout request through its lifecycle. Only PROCESSING / COMPLETED /
 * FAILED are valid targets. COMPLETED debits the mentor's wallet server-side —
 * the backend rejects it if the balance is short. Returns the failure reason
 * rather than throwing, so the exact message ("wallet balance is less than…")
 * always reaches the admin, not a generic server-action error. */
export async function processPayout(
  id: string,
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
  bankReference?: string,
): Promise<Result> {
  try {
    await backendFetch(`/payouts/${id}/process`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        ...(bankReference?.trim() ? { bankReference: bankReference.trim() } : {}),
      }),
    });
    revalidatePath('/dashboard/payouts');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update the payout',
    };
  }
}
