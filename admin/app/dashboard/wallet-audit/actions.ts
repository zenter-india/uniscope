'use server';

import { backendFetch } from '../../../lib/backend';

export interface UnreconciledWallet {
  walletId: string;
  userId: string | null;
  balanceMinor: number;
  ledgerSumMinor: number;
  unexplainedMinor: number;
  user: { id: string; displayName: string; uniqueId: string | null; role: string } | null;
}

/** Every wallet whose current balance doesn't sum-match its own ledger
 * history — see migration 20261002150000_add_wallet_balance_audit. Swallows
 * a backend failure into an empty list with an error string rather than
 * crashing the page, same pattern as the Integrations actions. */
export async function getUnreconciledWallets(): Promise<{
  wallets: UnreconciledWallet[];
  error?: string;
}> {
  try {
    const wallets = await backendFetch<UnreconciledWallet[]>('/wallet/admin/reconciliation');
    return { wallets };
  } catch (e) {
    return {
      wallets: [],
      error: e instanceof Error ? e.message : 'Could not reach the backend',
    };
  }
}
