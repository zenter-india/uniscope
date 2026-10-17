import { Injectable } from '@nestjs/common';
import {
  AppleTransactionStatus,
  LedgerEntryType,
  PayoutStatus,
  ReportStatus,
  SessionStatus,
  SessionType,
  TechnicalReportStatus,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';

/**
 * One-screen business health for the admin panel's Health page: payments,
 * calls, users and the admin work queues over the last 24 hours, plus a
 * database ping. Everything comes from the app's own database — this is
 * the "is the business running normally" view; Sentry is where errors and
 * alerts live (payment failures are reported there with flow:payments,
 * because a failed receipt never reaches the database).
 *
 * `warnings` is a short list of plain-English things that need a look,
 * computed from the numbers so the page can lead with them.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_SHOW_REASONS = ['ASPIRANT_NO_SHOW', 'MENTOR_NO_SHOW', 'NO_ANSWER'];
const QUEUE_STALE_HOURS = 48;
const SLOW_DB_MS = 1000;

export interface SystemHealthSummary {
  generatedAt: string;
  windowHours: number;
  database: { ok: boolean; latencyMs: number | null };
  server: { uptimeSeconds: number };
  payments: {
    topupsCount: number;
    topupsCreditedMinor: number;
    appleCredited: number;
    appleRefundedBeforeCredit: number;
    refundsNeedingManualFix: number;
    lastTopupAt: string | null;
  };
  calls: {
    requested: number;
    connected: number;
    endedBeforeConnect: number;
    noShows: number;
    pendingNow: number;
    liveNow: number;
    connectRatePercent: number | null;
  };
  users: { signups: number; activeUsers: number };
  queues: {
    verificationsPending: number;
    oldestVerificationAt: string | null;
    payoutsPending: number;
    oldestPayoutAt: string | null;
    reportsOpen: number;
    technicalReportsOpen: number;
  };
  warnings: string[];
}

@Injectable()
export class SystemHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<SystemHealthSummary> {
    const now = Date.now();
    const since = new Date(now - DAY_MS);

    const [
      topups,
      lastTopup,
      appleCredited,
      appleRefundedBeforeCredit,
      refundsNeedingManualFix,
      callsRequested,
      callsConnected,
      callsEndedBeforeConnect,
      callsNoShows,
      callsPendingNow,
      callsLiveNow,
      signups,
      activeUsers,
      verificationsPending,
      oldestVerification,
      payoutsPending,
      oldestPayout,
      reportsOpen,
      technicalReportsOpen,
    ] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: { type: LedgerEntryType.TOPUP, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { amountMinor: true },
      }),
      this.prisma.ledgerEntry.findFirst({
        where: { type: LedgerEntryType.TOPUP },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.appleTransaction.count({
        where: { status: AppleTransactionStatus.CREDITED, createdAt: { gte: since } },
      }),
      this.prisma.appleTransaction.count({
        where: {
          status: AppleTransactionStatus.REFUNDED,
          creditedAmountMinor: 0,
          createdAt: { gte: since },
        },
      }),
      this.prisma.appleTransaction.count({
        where: { status: AppleTransactionStatus.REFUND_PENDING_MANUAL },
      }),
      this.prisma.session.count({
        where: { type: SessionType.AUDIO_CALL, requestedAt: { gte: since } },
      }),
      this.prisma.session.count({
        where: {
          type: SessionType.AUDIO_CALL,
          startedAt: { not: null },
          endedAt: { gte: since },
        },
      }),
      this.prisma.session.count({
        where: {
          type: SessionType.AUDIO_CALL,
          endReason: 'ENDED_BEFORE_CONNECT',
          endedAt: { gte: since },
        },
      }),
      this.prisma.session.count({
        where: {
          type: SessionType.AUDIO_CALL,
          endReason: { in: NO_SHOW_REASONS },
          endedAt: { gte: since },
        },
      }),
      this.prisma.session.count({
        where: { type: SessionType.AUDIO_CALL, status: SessionStatus.PENDING },
      }),
      this.prisma.session.count({
        where: { type: SessionType.AUDIO_CALL, status: SessionStatus.IN_PROGRESS },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: since } } }),
      this.prisma.verificationRequest.count({
        where: {
          status: { in: [VerificationStatus.SUBMITTED, VerificationStatus.UNDER_REVIEW] },
        },
      }),
      this.prisma.verificationRequest.findFirst({
        where: {
          status: { in: [VerificationStatus.SUBMITTED, VerificationStatus.UNDER_REVIEW] },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.payoutRequest.count({
        where: { status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
      }),
      this.prisma.payoutRequest.findFirst({
        where: { status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.report.count({
        where: { status: { in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW] } },
      }),
      this.prisma.technicalReport.count({ where: { status: TechnicalReportStatus.OPEN } }),
    ]);

    // Measured after the queries above so a cold connection doesn't read as
    // a slow database.
    const database = await this.pingDatabase();

    const attempts = callsConnected + callsEndedBeforeConnect + callsNoShows;
    const connectRatePercent =
      attempts > 0 ? Math.round((callsConnected / attempts) * 100) : null;

    const warnings: string[] = [];
    if (!database.ok) warnings.push('The database did not respond.');
    else if (database.latencyMs != null && database.latencyMs > SLOW_DB_MS) {
      warnings.push(`The database is slow (${database.latencyMs} ms to answer).`);
    }
    if (refundsNeedingManualFix > 0) {
      warnings.push(
        `${refundsNeedingManualFix} Apple refund(s) need a manual wallet adjustment (the user had already spent the Uniminutes).`,
      );
    }
    if (appleRefundedBeforeCredit > 0) {
      warnings.push(
        `${appleRefundedBeforeCredit} Apple purchase(s) in the last 24h were refunded before they were credited — check whether those users got stuck.`,
      );
    }
    if (attempts >= 4 && connectRatePercent != null && connectRatePercent < 50) {
      warnings.push(
        `Only ${connectRatePercent}% of calls that ended in the last 24h actually connected (${callsConnected} of ${attempts}).`,
      );
    }
    const staleCutoff = now - QUEUE_STALE_HOURS * 60 * 60 * 1000;
    if (oldestVerification && oldestVerification.createdAt.getTime() < staleCutoff) {
      warnings.push(`A mentor verification has been waiting more than ${QUEUE_STALE_HOURS} hours.`);
    }
    if (oldestPayout && oldestPayout.createdAt.getTime() < staleCutoff) {
      warnings.push(`A mentor payout has been waiting more than ${QUEUE_STALE_HOURS} hours.`);
    }

    return {
      generatedAt: new Date(now).toISOString(),
      windowHours: 24,
      database,
      server: { uptimeSeconds: Math.round(process.uptime()) },
      payments: {
        topupsCount: topups._count._all,
        topupsCreditedMinor: topups._sum.amountMinor ?? 0,
        appleCredited,
        appleRefundedBeforeCredit,
        refundsNeedingManualFix,
        lastTopupAt: lastTopup?.createdAt.toISOString() ?? null,
      },
      calls: {
        requested: callsRequested,
        connected: callsConnected,
        endedBeforeConnect: callsEndedBeforeConnect,
        noShows: callsNoShows,
        pendingNow: callsPendingNow,
        liveNow: callsLiveNow,
        connectRatePercent,
      },
      users: { signups, activeUsers },
      queues: {
        verificationsPending,
        oldestVerificationAt: oldestVerification?.createdAt.toISOString() ?? null,
        payoutsPending,
        oldestPayoutAt: oldestPayout?.createdAt.toISOString() ?? null,
        reportsOpen,
        technicalReportsOpen,
      },
      warnings,
    };
  }

  private async pingDatabase(): Promise<{ ok: boolean; latencyMs: number | null }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: null };
    }
  }
}
