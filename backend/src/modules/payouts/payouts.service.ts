import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LedgerEntryType, PayoutStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { ProcessPayoutDto } from './dto/process-payout.dto.js';
import { PayoutRequestResponse, toPayoutRequestResponse } from './payout-response.js';

/** ₹200 minimum withdrawal — agreed product term, previously undocumented
 * in code (see CLAUDE.md "Payout automation"). Same minor-unit currency as
 * the wallet (1000 minor = ₹10), so ₹200 = 20,000 minor. */
export const MIN_PAYOUT_MINOR = 20_000;

const OPEN_STATUSES: PayoutStatus[] = [PayoutStatus.PENDING, PayoutStatus.PROCESSING];

/**
 * Payouts are deliberately manual/admin-triggered only — no auto-disbursement
 * (architecture decision, see CLAUDE.md). This service only computes *how
 * much* a mentor is owed and moves it out of their Uniminute wallet once an
 * admin confirms the bank transfer actually happened; it never touches a
 * bank or payment processor itself.
 */
@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Mentor-initiated. The amount is never mentor-chosen — it's the sum of
   * SESSION_CREDIT ledger entries since their last COMPLETED payout (or
   * account start), so a mentor can't request more than they've actually
   * earned and unpaid-out. Only one PENDING/PROCESSING request may be
   * outstanding at a time to prevent the same earnings window being claimed
   * twice while the first request is still in flight.
   */
  async requestPayout(mentorId: string): Promise<PayoutRequestResponse> {
    const existingOpen = await this.prisma.payoutRequest.findFirst({
      where: { mentorId, status: { in: OPEN_STATUSES } },
    });
    if (existingOpen) {
      throw new ConflictException(
        'You already have a payout request in progress. Wait for it to be processed before requesting another.',
      );
    }

    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId: mentorId } });

    const lastCompleted = await this.prisma.payoutRequest.findFirst({
      where: { mentorId, status: PayoutStatus.COMPLETED },
      orderBy: { periodEnd: 'desc' },
    });
    const periodStart = lastCompleted?.periodEnd ?? new Date(0);
    const periodEnd = new Date();

    const earned = await this.prisma.ledgerEntry.aggregate({
      where: {
        walletId: wallet.id,
        type: LedgerEntryType.SESSION_CREDIT,
        createdAt: { gt: periodStart, lte: periodEnd },
      },
      _sum: { amountMinor: true },
    });
    const amountMinor = earned._sum.amountMinor ?? 0;

    if (amountMinor < MIN_PAYOUT_MINOR) {
      throw new BadRequestException(
        `Minimum payout is ₹${MIN_PAYOUT_MINOR / 100} — you have ₹${(amountMinor / 100).toFixed(2)} in unpaid earnings.`,
      );
    }

    const payout = await this.prisma.payoutRequest.create({
      data: { mentorId, amountMinor, periodStart, periodEnd },
    });

    return toPayoutRequestResponse(payout);
  }

  async findMine(mentorId: string): Promise<PayoutRequestResponse[]> {
    const rows = await this.prisma.payoutRequest.findMany({
      where: { mentorId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPayoutRequestResponse);
  }

  async findAll(status?: PayoutStatus): Promise<PayoutRequestResponse[]> {
    const rows = await this.prisma.payoutRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toPayoutRequestResponse);
  }

  /**
   * Admin-only lifecycle transition. The wallet debit — the only step that
   * actually removes the money from the mentor's spendable Uniminute
   * balance — happens ONLY on the transition to COMPLETED, once the admin
   * has confirmed the bank transfer went through. PROCESSING and FAILED are
   * purely status bookkeeping so a failed transfer never touches the
   * wallet and the earnings remain claimable in the mentor's next request.
   */
  async process(
    payoutId: string,
    adminId: string,
    dto: ProcessPayoutDto,
  ): Promise<PayoutRequestResponse> {
    const payout = await this.prisma.payoutRequest.findUnique({ where: { id: payoutId } });
    if (!payout) {
      throw new NotFoundException(`Payout request '${payoutId}' not found`);
    }
    if (!OPEN_STATUSES.includes(payout.status)) {
      throw new ConflictException(`Cannot transition a payout in status ${payout.status}`);
    }

    if (dto.status === PayoutStatus.COMPLETED) {
      const wallet = await this.prisma.wallet.findUniqueOrThrow({
        where: { userId: payout.mentorId },
      });
      if (wallet.balanceMinor < payout.amountMinor) {
        throw new ConflictException(
          `Mentor's wallet balance (₹${(wallet.balanceMinor / 100).toFixed(2)}) is less than the payout amount (₹${(payout.amountMinor / 100).toFixed(2)}) — investigate before completing.`,
        );
      }

      await this.walletService.applyLedgerEntry({
        walletId: wallet.id,
        type: LedgerEntryType.PAYOUT,
        amountMinor: -payout.amountMinor,
        idempotencyKey: `payout:${payout.id}`,
        note: `Payout ${payout.id} — bank transfer confirmed by admin${dto.bankReference ? ` (ref ${dto.bankReference})` : ''}`,
      });
    }

    const updated = await this.prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: dto.status,
        bankReference: dto.bankReference,
        ...(dto.status !== PayoutStatus.PROCESSING && {
          processedBy: adminId,
          processedAt: new Date(),
        }),
      },
    });

    return toPayoutRequestResponse(updated);
  }
}
