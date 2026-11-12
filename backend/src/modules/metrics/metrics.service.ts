import { BadRequestException, Injectable } from '@nestjs/common';
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
const OPEN_PAYOUTS: PayoutStatus[] = [
  PayoutStatus.PENDING,
  PayoutStatus.PROCESSING,
];
const IN_REVIEW: VerificationStatus[] = [
  VerificationStatus.SUBMITTED,
  VerificationStatus.UNDER_REVIEW,
];

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Longest custom range the Overview will build (one series bucket per day). */
export const MAX_CUSTOM_DAYS = 366;

/** `YYYY-MM-DD` -> that UTC day's midnight, or null if it isn't a real date
 * (e.g. 2026-02-31 would silently roll into March with a plain Date). */
function parseUtcDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return dayKey(d) === value ? d : null;
}

/** The window an Overview is built for, and the equally long one before it. */
interface MetricsWindow {
  /** Inclusive start. */
  since: Date;
  /** Exclusive end. */
  until: Date;
  /** Start of the equally long window right before `since`. */
  prevSince: Date;
  /** Number of days covered (a rolling 24h is 1). */
  days: number;
  /** Set for a custom date range: the days picked (UTC), inclusive. */
  range: { from: string; to: string } | null;
}

/** Per-type ledger sums for one window. */
export interface RevenueTotals {
  topupMinor: number;
  mentorEarningsMinor: number;
  refundsMinor: number;
  adjustmentsMinor: number;
  payoutsPaidMinor: number;
}

export interface DashboardMetrics {
  rangeDays: number;
  /** The picked days (UTC, inclusive) for a custom range; null for 24h/7d/30d/90d. */
  range: { from: string; to: string } | null;
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
    /** Not a flow: what is owed to mentors right now, whatever the range. */
    payoutBacklogMinor: number;
    /** The same totals for the equally long window before this one. */
    previous: RevenueTotals;
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

  /** Rolling window ending now: 1 = last 24 hours, 7/30/90 = last N days. */
  async getOverview(days: number): Promise<DashboardMetrics> {
    const now = new Date();
    const since = new Date(now.getTime() - days * DAY_MS);
    return this.build({
      since,
      until: now,
      prevSince: new Date(since.getTime() - days * DAY_MS),
      days,
      range: null,
    });
  }

  /**
   * A custom range of whole UTC days, `from` and `to` both included. It is
   * compared with the equally long run of days right before it. A `to` in the
   * future is cut back to today (and echoed back in `range`).
   */
  async getOverviewForDates(
    from: string,
    to: string,
  ): Promise<DashboardMetrics> {
    const start = parseUtcDay(from);
    const end = parseUtcDay(to);
    if (!start || !end) {
      throw new BadRequestException(
        'from and to must be real dates written YYYY-MM-DD.',
      );
    }
    const now = new Date();
    const today = parseUtcDay(dayKey(now))!;
    if (start > today) {
      throw new BadRequestException('The range cannot start in the future.');
    }
    const lastDay = end > today ? today : end;
    if (lastDay < start) {
      throw new BadRequestException('"to" cannot be before "from".');
    }
    const days = Math.round((lastDay.getTime() - start.getTime()) / DAY_MS) + 1;
    if (days > MAX_CUSTOM_DAYS) {
      throw new BadRequestException(
        `Pick a range of at most ${MAX_CUSTOM_DAYS} days.`,
      );
    }
    return this.build({
      since: start,
      until: new Date(lastDay.getTime() + DAY_MS),
      prevSince: new Date(start.getTime() - days * DAY_MS),
      days,
      range: { from, to: dayKey(lastDay) },
    });
  }

  private async build(w: MetricsWindow): Promise<DashboardMetrics> {
    const { since, until, prevSince, days } = w;
    const notAdmin = { not: UserRole.ADMIN };

    const [
      newUsers,
      prevNewUsers,
      activeNow,
      activePrev,
      windowSessions,
      prevSessionCount,
      ledgerByType,
      ledgerByTypePrev,
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
        where: { createdAt: { gte: since, lt: until }, role: notAdmin },
        select: { createdAt: true, role: true },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: prevSince, lt: since }, role: notAdmin },
      }),
      this.prisma.user.count({
        where: { lastActiveAt: { gte: since, lt: until } },
      }),
      this.prisma.user.count({
        where: { lastActiveAt: { gte: prevSince, lt: since } },
      }),
      this.prisma.session.findMany({
        where: { requestedAt: { gte: since, lt: until } },
        select: { requestedAt: true, type: true },
      }),
      this.prisma.session.count({
        where: { requestedAt: { gte: prevSince, lt: since } },
      }),
      this.prisma.ledgerEntry.groupBy({
        by: ['type'],
        where: { createdAt: { gte: since, lt: until } },
        _sum: { amountMinor: true },
      }),
      this.prisma.ledgerEntry.groupBy({
        by: ['type'],
        where: { createdAt: { gte: prevSince, lt: since } },
        _sum: { amountMinor: true },
      }),
      this.prisma.payoutRequest.aggregate({
        where: { status: { in: OPEN_PAYOUTS } },
        _sum: { amountMinor: true },
      }),
      this.prisma.user.count({ where: { role: notAdmin } }),
      this.prisma.user.count({ where: { role: UserRole.MENTOR } }),
      this.prisma.user.count({
        where: {
          role: UserRole.MENTOR,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      }),
      this.prisma.university.count(),
      this.prisma.enrollmentLead.count({
        where: { status: EnrollmentLeadStatus.NEW },
      }),
      this.prisma.user.count({
        where: { verificationStatus: { in: IN_REVIEW } },
      }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.payoutRequest.count({
        where: { status: { in: OPEN_PAYOUTS } },
      }),
    ]);

    // Day buckets covering the window (oldest first). A 1-day window is a
    // rolling 24h that straddles two UTC dates, so a per-day series would
    // drop events; it has no chart, only the totals.
    const buckets =
      days === 1
        ? []
        : Array.from({ length: days }, (_, i) =>
            dayKey(new Date(since.getTime() + i * DAY_MS)),
          );
    const bucketIndex = new Map(buckets.map((d, i) => [d, i]));

    const signupSeries = buckets.map((date) => ({
      date,
      aspirant: 0,
      mentor: 0,
    }));
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

    const totalsFor = (
      rows: { type: LedgerEntryType; _sum: { amountMinor: number | null } }[],
    ): RevenueTotals => {
      const sum = (t: LedgerEntryType) =>
        rows.find((l) => l.type === t)?._sum.amountMinor ?? 0;
      return {
        topupMinor: sum(LedgerEntryType.TOPUP),
        mentorEarningsMinor: sum(LedgerEntryType.SESSION_CREDIT),
        refundsMinor: Math.abs(sum(LedgerEntryType.REFUND)),
        adjustmentsMinor: sum(LedgerEntryType.ADJUSTMENT),
        payoutsPaidMinor: Math.abs(sum(LedgerEntryType.PAYOUT)),
      };
    };
    const revenueNow = totalsFor(ledgerByType);

    const mentorSignups = newUsers.filter(
      (u) => u.role === UserRole.MENTOR,
    ).length;
    const callCount = windowSessions.filter(
      (s) => s.type === SessionType.AUDIO_CALL,
    ).length;

    return {
      rangeDays: days,
      range: w.range,
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
        ...revenueNow,
        payoutBacklogMinor: payoutBacklog._sum.amountMinor ?? 0,
        previous: totalsFor(ledgerByTypePrev),
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
