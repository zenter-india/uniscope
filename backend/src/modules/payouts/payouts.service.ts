import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LedgerEntryType, PayoutStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
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
/** How often a mentor can be reminded — checked against their own
 * notification history (see remindEligibleMentors) rather than a separate
 * "last reminded" column, so this needed no schema change to add. */
const REMINDER_COOLDOWN_DAYS = 7;

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Nudges mentors who've crossed the payout-eligible threshold but haven't
   * requested one — earned money just sitting unclaimed and, before this,
   * unnoticed. Payouts stay mentor-initiated (see class docs); this only
   * makes the "you can request one" fact visible, it never requests on
   * their behalf. Runs daily but re-notifying the same mentor is capped at
   * once every REMINDER_COOLDOWN_DAYS via their own notification history,
   * so this can't turn into a daily nag once someone's above the threshold.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async remindEligibleMentors(): Promise<void> {
    const mentors = await this.prisma.user.findMany({
      where: { role: UserRole.MENTOR, isActive: true, isBanned: false, wallet: { isNot: null } },
      select: { id: true, wallet: { select: { id: true } } },
    });

    let reminded = 0;
    for (const mentor of mentors) {
      if (!mentor.wallet) continue;
      try {
        if (await this.isReminderDue(mentor.id, mentor.wallet.id)) {
          await this.notifications.send({
            userId: mentor.id,
            type: 'SYSTEM',
            title: "You've got Uniminutes ready to withdraw",
            body: `You're above the ₹${MIN_PAYOUT_MINOR / 100} minimum — request a payout from your Earnings tab whenever you're ready.`,
          });
          reminded += 1;
        }
      } catch (err) {
        // One mentor's eligibility check failing must not stop the rest of
        // the batch from being checked.
        this.logger.error(`Payout-reminder check failed for mentor ${mentor.id}`, err);
      }
    }
    if (reminded > 0) {
      this.logger.log(`Sent ${reminded} payout-eligible reminder(s)`);
    }
  }

  private async isReminderDue(mentorId: string, walletId: string): Promise<boolean> {
    const existingOpen = await this.prisma.payoutRequest.findFirst({
      where: { mentorId, status: { in: OPEN_STATUSES } },
    });
    if (existingOpen) return false;

    const recentReminder = await this.prisma.notification.findFirst({
      where: {
        userId: mentorId,
        type: 'SYSTEM',
        title: "You've got Uniminutes ready to withdraw",
        createdAt: { gt: new Date(Date.now() - REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000) },
      },
    });
    if (recentReminder) return false;

    const lastCompleted = await this.prisma.payoutRequest.findFirst({
      where: { mentorId, status: PayoutStatus.COMPLETED },
      orderBy: { periodEnd: 'desc' },
    });
    const periodStart = lastCompleted?.periodEnd ?? new Date(0);

    const earned = await this.prisma.ledgerEntry.aggregate({
      where: {
        walletId,
        type: LedgerEntryType.SESSION_CREDIT,
        createdAt: { gt: periodStart },
      },
      _sum: { amountMinor: true },
    });

    return (earned._sum.amountMinor ?? 0) >= MIN_PAYOUT_MINOR;
  }

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
