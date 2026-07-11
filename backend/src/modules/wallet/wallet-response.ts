import { LedgerEntry, Wallet } from '@prisma/client';

export interface WalletResponse {
  id: string;
  balanceMinor: number;
  updatedAt: Date;
}

export function toWalletResponse(wallet: Wallet): WalletResponse {
  return {
    id: wallet.id,
    balanceMinor: wallet.balanceMinor,
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
