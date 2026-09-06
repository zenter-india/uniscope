import { LedgerEntry, Wallet } from '@prisma/client';

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
