import { Injectable } from '@nestjs/common';
import {
  EnrollmentLeadStatus,
  LedgerEntryType,
  PayoutStatus,
  SessionType,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_PAYOUTS: PayoutStatus[] = [PayoutStatus.PENDING, PayoutStatus.PROCESSING];
const IN_REVIEW: VerificationStatus[] = [
  VerificationStatus.SUBMITTED,
  VerificationStatus.UNDER_REVIEW,
];

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export interface DashboardMetrics {
  rangeDays: number;
  signups: {
    total: number;
    prevTotal: number;
    aspirant: number;
    mentor: number;
    series: { date: string; aspirant: number; mentor: number }[];
  };
  activeUsers: { current: number; previous: number };
  sessions: {
    total: number;
    prevTotal: number;
    chat: number;
    call: number;
    series: { date: string; chat: number; call: number }[];
  };
  revenue: {
    topupMinor: number;
    mentorEarningsMinor: number;
    refundsMinor: number;
    adjustmentsMinor: number;
    payoutsPaidMinor: number;
    payoutBacklogMinor: number;
  };
  queues: {
    newLeads: number;
    pendingVerifications: number;
    openReports: number;
    pendingPayouts: number;
  };
  totals: {
    users: number;
    mentors: number;
    verifiedMentors: number;
    universities: number;
  };
}

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(days: number): Promise<DashboardMetrics> {
    const now = new Date();
    const since = new Date(now.getTime() - days * DAY_MS);
    const prevSince = new Date(since.getTime() - days * DAY_MS);
    const notAdmin = { not: UserRole.ADMIN };

    const [
      newUsers,
      prevNewUsers,
      activeNow,
      activePrev,
      windowSessions,
      prevSessionCount,
      ledgerByType,
      payoutBacklog,
      totalUsers,
      totalMentors,
      verifiedMentors,
      totalUniversities,
      newLeads,
      pendingVerifications,
      openReports,
      pendingPayouts,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: since }, role: notAdmin },
        select: { createdAt: true, role: true },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: prevSince, lt: since }, role: notAdmin },
      }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: since } } }),
      this.prisma.user.count({
        where: { lastActiveAt: { gte: prevSince, lt: since } },
      }),
      this.prisma.session.findMany({
        where: { requestedAt: { gte: since } },
        select: { requestedAt: true, type: true },
      }),
      this.prisma.session.count({
        where: { requestedAt: { gte: prevSince, lt: since } },
      }),
      this.prisma.ledgerEntry.groupBy({
        by: ['type'],
        where: { createdAt: { gte: since } },
        _sum: { amountMinor: true },
      }),
      this.prisma.payoutRequest.aggregate({
        where: { status: { in: OPEN_PAYOUTS } },
        _sum: { amountMinor: true },
      }),
      this.prisma.user.count({ where: { role: notAdmin } }),
      this.prisma.user.count({ where: { role: UserRole.MENTOR } }),
      this.prisma.user.count({
        where: { role: UserRole.MENTOR, verificationStatus: VerificationStatus.VERIFIED },
      }),
      this.prisma.university.count(),
      this.prisma.enrollmentLead.count({ where: { status: EnrollmentLeadStatus.NEW } }),
      this.prisma.user.count({ where: { verificationStatus: { in: IN_REVIEW } } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.payoutRequest.count({ where: { status: { in: OPEN_PAYOUTS } } }),
    ]);

    // Day buckets covering the window (oldest first).
    const buckets = Array.from({ length: days }, (_, i) =>
      dayKey(new Date(since.getTime() + i * DAY_MS)),
    );
    const bucketIndex = new Map(buckets.map((d, i) => [d, i]));

    const signupSeries = buckets.map((date) => ({ date, aspirant: 0, mentor: 0 }));
    for (const u of newUsers) {
      const i = bucketIndex.get(dayKey(u.createdAt));
      if (i === undefined) continue;
      if (u.role === UserRole.MENTOR) signupSeries[i].mentor += 1;
      else signupSeries[i].aspirant += 1;
    }

    const sessionSeries = buckets.map((date) => ({ date, chat: 0, call: 0 }));
    for (const s of windowSessions) {
      const i = bucketIndex.get(dayKey(s.requestedAt));
      if (i === undefined) continue;
      if (s.type === SessionType.AUDIO_CALL) sessionSeries[i].call += 1;
      else sessionSeries[i].chat += 1;
    }

    const ledgerSum = (t: LedgerEntryType) =>
      ledgerByType.find((l) => l.type === t)?._sum.amountMinor ?? 0;

    const mentorSignups = newUsers.filter((u) => u.role === UserRole.MENTOR).length;
    const callCount = windowSessions.filter((s) => s.type === SessionType.AUDIO_CALL).length;

    return {
      rangeDays: days,
      signups: {
        total: newUsers.length,
        prevTotal: prevNewUsers,
        aspirant: newUsers.length - mentorSignups,
        mentor: mentorSignups,
        series: signupSeries,
      },
      activeUsers: { current: activeNow, previous: activePrev },
      sessions: {
        total: windowSessions.length,
        prevTotal: prevSessionCount,
        chat: windowSessions.length - callCount,
        call: callCount,
        series: sessionSeries,
      },
      revenue: {
        topupMinor: ledgerSum(LedgerEntryType.TOPUP),
        mentorEarningsMinor: ledgerSum(LedgerEntryType.SESSION_CREDIT),
        refundsMinor: Math.abs(ledgerSum(LedgerEntryType.REFUND)),
        adjustmentsMinor: ledgerSum(LedgerEntryType.ADJUSTMENT),
        payoutsPaidMinor: Math.abs(ledgerSum(LedgerEntryType.PAYOUT)),
        payoutBacklogMinor: payoutBacklog._sum.amountMinor ?? 0,
      },
      queues: {
        newLeads,
        pendingVerifications,
        openReports,
        pendingPayouts,
      },
      totals: {
        users: totalUsers,
        mentors: totalMentors,
        verifiedMentors,
        universities: totalUniversities,
      },
    };
  }
}
