import { LedgerEntry, Wallet, WalletBalanceAudit } from '@prisma/client';

export interface WalletResponse {
  id: string;
  /** Total credited balance — includes anything currently held for a
   * pending call. */
  balanceMinor: number;
  /** Sum of every ACTIVE WalletHold on this wallet: money reserved for a
   * booked-but-not-yet-connected call. Not spent — released if the call is
   * rejected, cancelled, or nobody joins. */
  reservedMinor: number;
  /** balanceMinor − reservedMinor: what a new booking can actually draw
   * on. This is the number the booking check enforces. */
  availableMinor: number;
  updatedAt: Date;
}

export function toWalletResponse(
  wallet: Wallet,
  reservedMinor = 0,
): WalletResponse {
  return {
    id: wallet.id,
    balanceMinor: wallet.balanceMinor,
    reservedMinor,
    availableMinor: wallet.balanceMinor - reservedMinor,
    updatedAt: wallet.updatedAt,
  };
}

export interface LedgerEntryResponse {
  id: string;
  type: LedgerEntry['type'];
  amountMinor: number;
  balanceAfterMinor: number;
  sessionId: string | null;
  note: string | null;
  createdAt: Date;
  /** The OTHER party on the session this entry is for (mentor's name for an
   * aspirant's entry, aspirant's name for a mentor's) — null for anything
   * not tied to a session (top-up, payout, admin adjustment) or when the
   * session lookup didn't find a match. Populated by WalletService.getLedger
   * via a small batched join, not by this plain mapper. */
  counterpartName?: string | null;
  /** AUDIO_CALL only: the booked slot length, for "6 min" style detail next
   * to a call entry. Same batched-join caveat as counterpartName. */
  callSlotMinutes?: number | null;
}

export function toLedgerEntryResponse(entry: LedgerEntry): LedgerEntryResponse {
  return {
    id: entry.id,
    type: entry.type,
    amountMinor: entry.amountMinor,
    balanceAfterMinor: entry.balanceAfterMinor,
    sessionId: entry.sessionId,
    note: entry.note,
    createdAt: entry.createdAt,
  };
}

/** One wallet whose current balance doesn't sum-match its own ledger
 * history — see migration 20261002150000_add_wallet_balance_audit and the
 * `wallet_ledger_reconciliation` view it adds. Assembled in
 * WalletService.getUnreconciledWallets from a raw query + a batched user
 * lookup, not a single Prisma model, so there's no toXResponse mapper for
 * it (unlike every other response here) — just the shared shape. */
export interface UnreconciledWalletResponse {
  walletId: string;
  userId: string | null;
  balanceMinor: number;
  ledgerSumMinor: number;
  unexplainedMinor: number;
  user: { id: string; displayName: string; uniqueId: string | null; role: string } | null;
}

/** One row of the DB-trigger-populated wallet_balance_audit trail for a
 * single wallet. No application code ever writes this table — only the
 * `wallet_balance_audit_trigger` / `wallet_balance_audit_insert_trigger`
 * triggers do, on every change to Wallet.balanceMinor. `changedBy` is the
 * Postgres role that made the change — today that's always the same
 * shared role for the live backend AND any human with direct DB access
 * (see the migration's own doc comment), so it identifies "something
 * touched the DB directly," not who. */
export interface WalletBalanceAuditResponse {
  id: string;
  walletId: string;
  userId: string | null;
  oldBalanceMinor: number;
  newBalanceMinor: number;
  deltaMinor: number;
  changedBy: string;
  clientAddr: string | null;
  applicationName: string | null;
  /** Postgres transaction id (txid_current()) — returned as a string since
   * it's a Prisma BigInt and the default JSON serializer can't handle a
   * raw bigint. */
  txid: string;
  /** False whenever this change didn't land alongside a ledger_entries row
   * for the exact same delta within 10 seconds — the signature of a direct
   * SQL edit that bypassed WalletService, as opposed to a real credit/debit
   * path (which always writes both rows in the same DB transaction). */
  matchedLedgerEntry: boolean;
  createdAt: Date;
}

export function toWalletBalanceAuditResponse(
  entry: WalletBalanceAudit,
): WalletBalanceAuditResponse {
  return {
    id: entry.id,
    walletId: entry.walletId,
    userId: entry.userId,
    oldBalanceMinor: entry.oldBalanceMinor,
    newBalanceMinor: entry.newBalanceMinor,
    deltaMinor: entry.deltaMinor,
    changedBy: entry.changedBy,
    clientAddr: entry.clientAddr,
    applicationName: entry.applicationName,
    txid: entry.txid.toString(),
    matchedLedgerEntry: entry.matchedLedgerEntry,
    createdAt: entry.createdAt,
  };
}
