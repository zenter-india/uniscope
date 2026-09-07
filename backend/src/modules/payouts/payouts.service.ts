import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LedgerEntryType, PayoutStatus, Prisma, UserRole } from '@prisma/client';
import { adminOrderBy } from '../../common/helpers/admin-sort.helper.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { ProcessPayoutDto } from './dto/process-payout.dto.js';
import { PayoutRequestResponse, toPayoutRequestResponse } from './payout-response.js';

const OPEN_STATUSES: PayoutStatus[] = [PayoutStatus.PENDING, PayoutStatus.PROCESSING];

/**
 * Payouts are deliberately manual/admin-triggered only — no auto-disbursement
 * (architecture decision, see CLAUDE.md). This service only computes *how
 * much* a mentor is owed and moves it out of their Uniminute wallet once an
 * admin confirms the bank transfer actually happened; it never touches a
 * bank or payment processor itself.
 */
/** Weekly cadence, not a minimum amount (2026-09-07, replaces the old ₹200
 * minimum — MIN_PAYOUT_MINOR — per explicit product decision). A mentor can
 * request a payout once every 7 days, for whatever they've earned since
 * their last request, however small. Checked against the mentor's own most
 * recent PayoutRequest row (any status — a rejected/failed one still used up
 * that week's request), so this needed no schema change either. Also reused
 * as the daily reminder's own cooldown — no point nudging someone who isn't
 * eligible to request again yet. */
const PAYOUT_REQUEST_COOLDOWN_DAYS = 7;

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
            body: "You're eligible to request a payout again — request it from your Earnings tab whenever you're ready.",
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

    // Not eligible to request again yet — no point reminding.
    const lastRequest = await this.prisma.payoutRequest.findFirst({
      where: { mentorId },
      orderBy: { createdAt: 'desc' },
    });
    if (lastRequest) {
      const cooldownEndsAt = new Date(
        lastRequest.createdAt.getTime() + PAYOUT_REQUEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
      );
      if (cooldownEndsAt > new Date()) return false;
    }

    const recentReminder = await this.prisma.notification.findFirst({
      where: {
        userId: mentorId,
        type: 'SYSTEM',
        title: "You've got Uniminutes ready to withdraw",
        createdAt: {
          gt: new Date(Date.now() - PAYOUT_REQUEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000),
        },
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

    // No minimum anymore — any unpaid earnings at all makes a reminder
    // worthwhile once the mentor is otherwise eligible to request.
    return (earned._sum.amountMinor ?? 0) > 0;
  }

  /**
   * Mentor-initiated. The amount is never mentor-chosen — it's the sum of
   * SESSION_CREDIT ledger entries since their last COMPLETED payout (or
   * account start), so a mentor can't request more than they've actually
   * earned and unpaid-out. Only one PENDING/PROCESSING request may be
   * outstanding at a time to prevent the same earnings window being claimed
   * twice while the first request is still in flight. **No minimum amount**
   * (2026-09-07, replaces the old ₹200 floor) — instead capped to once every
   * PAYOUT_REQUEST_COOLDOWN_DAYS, checked against the mentor's own most
   * recent request regardless of its outcome.
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

    const lastRequest = await this.prisma.payoutRequest.findFirst({
      where: { mentorId },
      orderBy: { createdAt: 'desc' },
    });
    if (lastRequest) {
      const cooldownEndsAt = new Date(
        lastRequest.createdAt.getTime() + PAYOUT_REQUEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
      );
      if (cooldownEndsAt > new Date()) {
        throw new BadRequestException(
          `You can request a payout once every ${PAYOUT_REQUEST_COOLDOWN_DAYS} days — next eligible ${cooldownEndsAt.toISOString()}.`,
        );
      }
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

    if (amountMinor <= 0) {
      throw new BadRequestException('No unpaid earnings to withdraw yet.');
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

  /** Admin list — FIFO by request time, with the mentor's name and current
   * wallet balance attached so the reviewer isn't looking at bare UUIDs. */
  async findAll(
    status?: PayoutStatus,
    sortBy?: string,
    sortDir?: 'asc' | 'desc',
  ): Promise<PayoutRequestResponse[]> {
    const rows = await this.prisma.payoutRequest.findMany({
      where: status ? { status } : undefined,
      // Default is oldest-first (FIFO — the queue an admin works top-down);
      // an explicit sort overrides that.
      orderBy: adminOrderBy(
        sortBy,
        sortDir,
        { requested: 'createdAt', amount: 'amountMinor', status: 'status', period: 'periodEnd' },
        { createdAt: 'asc' },
      ) as Prisma.PayoutRequestOrderByWithRelationInput[],
      include: {
        mentor: {
          select: {
            displayName: true,
            wallet: { select: { balanceMinor: true } },
          },
        },
      },
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
