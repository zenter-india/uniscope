import { PayoutRequest } from '@prisma/client';
import { decryptFieldSafe } from '../../common/helpers/profile-encryption.helper.js';

const OVERDUE_AFTER_MS = 48 * 60 * 60 * 1000; // 48h processing-window SLA (see CLAUDE.md)

export interface PayoutRequestResponse {
  id: string;
  mentorId: string;
  amountMinor: number;
  status: PayoutRequest['status'];
  periodStart: Date;
  periodEnd: Date;
  bankReference: string | null;
  processedAt: Date | null;
  createdAt: Date;
  /** True once a still-PENDING/PROCESSING request has sat longer than the
   * agreed 24-48h SLA — surfaced for the admin UI, never blocks anything. */
  isOverdue: boolean;
  /** Populated only when the row was loaded with the mentor relation (the
   * admin list) — undefined on the mentor's own `mine` view. */
  mentorName?: string;
  /** The mentor's current spendable balance, in minor units. Lets the admin
   * see up front whether "Mark paid" (which debits this) will succeed.
   * Undefined unless the mentor+wallet relation was loaded. */
  mentorWalletBalanceMinor?: number | null;
  /** The mentor's saved payout UPI ID, decrypted — what the admin actually
   * transfers to. Null if the mentor has none set (requestPayout blocks
   * that, so an existing request always has one). Undefined unless the
   * mentor+profile relation was loaded. */
  mentorUpiId?: string | null;
}

type PayoutRow = PayoutRequest & {
  mentor?: {
    displayName: string;
    wallet?: { balanceMinor: number } | null;
    profile?: { upiIdEncrypted: string | null } | null;
  } | null;
};

export function toPayoutRequestResponse(payout: PayoutRow): PayoutRequestResponse {
  const isOpen = payout.status === 'PENDING' || payout.status === 'PROCESSING';
  const isOverdue =
    isOpen && Date.now() - payout.createdAt.getTime() > OVERDUE_AFTER_MS;

  return {
    id: payout.id,
    mentorId: payout.mentorId,
    amountMinor: payout.amountMinor,
    status: payout.status,
    periodStart: payout.periodStart,
    periodEnd: payout.periodEnd,
    bankReference: payout.bankReference,
    processedAt: payout.processedAt,
    createdAt: payout.createdAt,
    isOverdue,
    ...(payout.mentor != null && {
      mentorName: payout.mentor.displayName,
      mentorWalletBalanceMinor: payout.mentor.wallet?.balanceMinor ?? null,
      mentorUpiId: decryptFieldSafe(payout.mentor.profile?.upiIdEncrypted),
    }),
  };
}
