import { PayoutRequest } from '@prisma/client';

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
}

export function toPayoutRequestResponse(payout: PayoutRequest): PayoutRequestResponse {
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
  };
}
