import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { MetricsQueryDto } from '../metrics/dto/metrics-query.dto.js';
import { isTopupPlatform } from '../wallet/topup-platform.js';
import type { TopupPlatform } from '../wallet/topup-platform.js';
import { bucketKeys, bucketUnitFor, type BucketUnit } from './money-buckets.js';
import { resolveMoneyRange } from './money-range.js';
import { TOPUPS_CTE_SQL } from './money-sql.js';

/** 1 Uniminute = 1000 minor units (₹10) = one minute of call time. */
const MINOR_PER_UNIMINUTE = 1000;
const TOP_PAYERS = 10;
const OWED_MENTORS = 50;
const DAY_MS = 86_400_000;

type Big = bigint | number;
const num = (v: Big | null | undefined): number => (v == null ? 0 : Number(v));
const perPlatform = (): Record<TopupPlatform, number> => ({
  android: 0,
  ios: 0,
  web: 0,
});

// ---- Trend ----------------------------------------------------------------

export interface MoneyTrendPoint {
  /** `YYYY-MM-DD`, the UTC start of the day, week or month. */
  bucket: string;
  topups: number;
  /** Rupees paid (paise), real payments with a known price. */
  paidMinor: number;
  paidByPlatformMinor: Record<TopupPlatform, number>;
  uniminutes: Record<TopupPlatform, number>;
  mentorEarnedMinor: number;
  /** Billed calls and the minutes billed for them. */
  calls: number;
  minutes: number;
}

export interface MoneyTrend {
  unit: BucketUnit;
  points: MoneyTrendPoint[];
}

// ---- Payers and packs -----------------------------------------------------

export interface MoneyPack {
  uniminutes: number;
  count: number;
  /** Share (0..1) of the range's top-ups. */
  share: number;
  paidMinor: number;
  byPlatform: Record<TopupPlatform, number>;
}

export interface MoneyTopPayer {
  userId: string;
  name: string;
  uniqueId: string | null;
  topups: number;
  uniminutes: number;
  paidMinor: number;
  platforms: TopupPlatform[];
  lastAt: string;
}

export interface MoneyPayers {
  stats: {
    /** People who made at least one real payment in the range. */
    payers: number;
    /** …of whom their very first payment ever was in the range. */
    newPayers: number;
    /** …who had already paid before the range. */
    returningPayers: number;
    /** …who paid at least twice within the range. */
    repeatInRange: number;
    topups: number;
    uniminutes: number;
    paidMinor: number;
    averageUniminutes: number | null;
    /** All time, whatever the range. */
    payersEver: number;
    repeatEver: number;
    /** Active aspirant accounts: what "ever paid" is a share of. */
    aspirants: number;
  };
  packs: MoneyPack[];
  topPayers: MoneyTopPayer[];
}

// ---- Balances -------------------------------------------------------------

/** Where a wallet balance came from. TEST_CREDIT is a TOPUP that was not a
 * real payment; MANUAL_EARNINGS is a mentor credit with no call behind it. */
export type BalanceKind =
  | 'BOUGHT'
  | 'TEST_CREDIT'
  | 'MANUAL_EARNINGS'
  | 'SESSION_DEBIT'
  | 'SESSION_CREDIT'
  | 'PAYOUT'
  | 'ADJUSTMENT'
  | 'REFUND'
  | 'HOLD_RELEASE';

export interface MoneyBalanceBreakdown {
  /** Wallets holding something. */
  wallets: number;
  /** What all of them hold together. */
  balanceMinor: number;
  /** Every kind of entry that ever touched these wallets, with its net total. */
  lines: { kind: BalanceKind; entries: number; minor: number }[];
  /** Balance minus the lines: 0 when the ledger explains it fully. */
  unexplainedMinor: number;
}

export interface MoneyOwedMentor {
  id: string;
  name: string;
  uniqueId: string | null;
  balanceMinor: number;
  lastPayoutAt: string | null;
  /** When the earnings still owed started to build up (the first earning
   * after the last payout, or the first ever). */
  owedSince: string | null;
  daysOwed: number | null;
}

export interface MoneyBalances {
  aspirants: MoneyBalanceBreakdown;
  mentors: MoneyBalanceBreakdown;
  owedMentors: MoneyOwedMentor[];
}

// ---- Usage ----------------------------------------------------------------

export const USAGE_OUTCOMES = [
  'billed',
  'declined',
  'cancelled',
  'aspirant_no_show',
  'mentor_no_show',
  'not_connected',
  'open',
] as const;
export type UsageOutcome = (typeof USAGE_OUTCOMES)[number];

export interface MoneyUsage {
  range: { from: string; to: string } | null;
  days: number;
  /** Call requests in the range. */
  requested: number;
  billedCalls: number;
  billedMinutes: number;
  billedCostMinor: number;
  /** Billed minutes per billed call. */
  averageBilledMinutes: number | null;
  /** Share (0..1) of requests that ended in a billed call. */
  billedShare: number | null;
  callers: number;
  mentorsCalled: number;
  /** Every outcome, in a fixed order, zeros included. */
  outcomes: {
    outcome: UsageOutcome;
    count: number;
    minutes: number;
    costMinor: number;
  }[];
}

interface TrendTopupRow {
  bucket: string;
  platform: string | null;
  topups: number;
  credited_minor: Big;
  paid_minor: Big;
}
interface TrendFlowRow {
  bucket: string;
  earned_minor: Big;
  calls: number;
  debited_minor: Big;
}
interface PayerStatsRow {
  payers: number;
  new_payers: number;
  repeat_in_range: number;
  topups: number;
  credited_minor: Big;
  paid_minor: Big;
  payers_ever: number;
  repeat_ever: number;
  aspirants: number;
}
interface PackRow {
  uniminutes: number;
  platform: string | null;
  topups: number;
  paid_minor: Big;
}
interface TopPayerRow {
  id: string;
  display_name: string;
  unique_id: string | null;
  topups: number;
  credited_minor: Big;
  paid_minor: Big;
  platforms: string | null;
  last_at: Date;
}
interface KindRow {
  role: string;
  kind: string;
  entries: number;
  sum_minor: Big;
}
interface WalletTotalRow {
  role: string;
  wallets: number;
  balance_minor: Big;
}
interface OwedMentorRow {
  id: string;
  display_name: string;
  unique_id: string | null;
  balance_minor: number;
  last_payout_at: Date | null;
  owed_since: Date | null;
}
interface OutcomeRow {
  outcome: string;
  sessions: number;
  billed_minutes: Big;
  cost_minor: Big;
}
interface UsagePeopleRow {
  callers: number;
  mentors_called: number;
}

/** Deeper read-only analytics for the admin Money page: trends over time,
 * who pays and what they buy, where balances come from, and call usage. Like
 * the rest of the Money page it only reads the append-only ledger (and the
 * session list), so it can never disagree with a wallet. */
@Injectable()
export class MoneyAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Money in by platform, mentor earnings and call volume, a bar per day /
   * week / month with every bar present even when nothing happened. */
  async trend(query: MetricsQueryDto): Promise<MoneyTrend> {
    const w = resolveMoneyRange(query);
    const unit = bucketUnitFor(w.days);
    const [topupRows, flowRows] = await Promise.all([
      this.prisma.$queryRaw<TrendTopupRow[]>(Prisma.sql`
        WITH ${TOPUPS_CTE_SQL}
        SELECT to_char(date_trunc(${unit}, timezone('UTC', t.created_at)), 'YYYY-MM-DD') AS bucket,
               t.platform AS platform,
               COUNT(*)::int AS topups,
               COALESCE(SUM(t.amount_minor), 0)::bigint AS credited_minor,
               COALESCE(SUM(t.paid_minor), 0)::bigint AS paid_minor
        FROM topups t
        WHERE t.is_payment
          AND t.created_at >= ${w.since}::timestamptz
          AND t.created_at < ${w.until}::timestamptz
        GROUP BY 1, 2`),
      this.prisma.$queryRaw<TrendFlowRow[]>(Prisma.sql`
        SELECT to_char(date_trunc(${unit}, timezone('UTC', le.created_at)), 'YYYY-MM-DD') AS bucket,
               COALESCE(SUM(le.amount_minor) FILTER (WHERE le.type = 'SESSION_CREDIT' AND le.session_id IS NOT NULL), 0)::bigint AS earned_minor,
               COUNT(DISTINCT le.session_id) FILTER (WHERE le.type = 'SESSION_DEBIT' AND le.session_id IS NOT NULL)::int AS calls,
               COALESCE(SUM(-le.amount_minor) FILTER (WHERE le.type = 'SESSION_DEBIT' AND le.session_id IS NOT NULL), 0)::bigint AS debited_minor
        FROM ledger_entries le
        WHERE le.type IN ('SESSION_CREDIT', 'SESSION_DEBIT')
          AND le.created_at >= ${w.since}::timestamptz
          AND le.created_at < ${w.until}::timestamptz
        GROUP BY 1`),
    ]);

    const points = new Map<string, MoneyTrendPoint>(
      bucketKeys(w.since, w.until, unit).map((bucket) => [
        bucket,
        {
          bucket,
          topups: 0,
          paidMinor: 0,
          paidByPlatformMinor: perPlatform(),
          uniminutes: perPlatform(),
          mentorEarnedMinor: 0,
          calls: 0,
          minutes: 0,
        },
      ]),
    );
    for (const r of topupRows) {
      const p = points.get(r.bucket);
      if (!p || !isTopupPlatform(r.platform)) continue;
      p.topups += r.topups;
      p.paidMinor += num(r.paid_minor);
      p.paidByPlatformMinor[r.platform] += num(r.paid_minor);
      p.uniminutes[r.platform] += Math.round(
        num(r.credited_minor) / MINOR_PER_UNIMINUTE,
      );
    }
    for (const r of flowRows) {
      const p = points.get(r.bucket);
      if (!p) continue;
      p.mentorEarnedMinor += num(r.earned_minor);
      p.calls += r.calls;
      p.minutes += Math.round(num(r.debited_minor) / MINOR_PER_UNIMINUTE);
    }
    return { unit, points: [...points.values()] };
  }

  /** Who pays (new, returning, repeat), what share of aspirants ever paid,
   * which pack sells, and the biggest payers — real payments only. */
  async payers(query: MetricsQueryDto): Promise<MoneyPayers> {
    const w = resolveMoneyRange(query);
    const inRange = Prisma.sql`created_at >= ${w.since}::timestamptz AND created_at < ${w.until}::timestamptz`;
    const [statRows, packRows, topRows] = await Promise.all([
      this.prisma.$queryRaw<PayerStatsRow[]>(Prisma.sql`
        WITH ${TOPUPS_CTE_SQL},
        pay AS (
          SELECT user_id, created_at, amount_minor, paid_minor FROM topups WHERE is_payment
        ),
        ever AS (
          SELECT user_id, MIN(created_at) AS first_at, COUNT(*) AS payments FROM pay GROUP BY user_id
        ),
        in_range AS (
          SELECT user_id, COUNT(*) AS n, SUM(amount_minor) AS credited, COALESCE(SUM(paid_minor), 0) AS paid
          FROM pay WHERE ${inRange} GROUP BY user_id
        )
        SELECT (SELECT COUNT(*)::int FROM in_range) AS payers,
               (SELECT COUNT(*)::int FROM in_range r JOIN ever e USING (user_id)
                 WHERE e.first_at >= ${w.since}::timestamptz AND e.first_at < ${w.until}::timestamptz) AS new_payers,
               (SELECT COUNT(*)::int FROM in_range WHERE n >= 2) AS repeat_in_range,
               (SELECT COALESCE(SUM(n), 0)::int FROM in_range) AS topups,
               (SELECT COALESCE(SUM(credited), 0)::bigint FROM in_range) AS credited_minor,
               (SELECT COALESCE(SUM(paid), 0)::bigint FROM in_range) AS paid_minor,
               (SELECT COUNT(*)::int FROM ever) AS payers_ever,
               (SELECT COUNT(*)::int FROM ever WHERE payments >= 2) AS repeat_ever,
               (SELECT COUNT(*)::int FROM users WHERE role = 'ASPIRANT' AND is_active AND deleted_at IS NULL) AS aspirants`),
      this.prisma.$queryRaw<PackRow[]>(Prisma.sql`
        WITH ${TOPUPS_CTE_SQL}
        SELECT (t.amount_minor / ${MINOR_PER_UNIMINUTE})::int AS uniminutes,
               t.platform AS platform,
               COUNT(*)::int AS topups,
               COALESCE(SUM(t.paid_minor), 0)::bigint AS paid_minor
        FROM topups t
        WHERE t.is_payment
          AND t.created_at >= ${w.since}::timestamptz
          AND t.created_at < ${w.until}::timestamptz
        GROUP BY 1, 2`),
      this.prisma.$queryRaw<TopPayerRow[]>(Prisma.sql`
        WITH ${TOPUPS_CTE_SQL}
        SELECT u.id,
               u.display_name,
               u.unique_id,
               COUNT(*)::int AS topups,
               SUM(t.amount_minor)::bigint AS credited_minor,
               COALESCE(SUM(t.paid_minor), 0)::bigint AS paid_minor,
               string_agg(DISTINCT t.platform, ',') AS platforms,
               MAX(t.created_at) AS last_at
        FROM topups t
        JOIN users u ON u.id = t.user_id
        WHERE t.is_payment
          AND t.created_at >= ${w.since}::timestamptz
          AND t.created_at < ${w.until}::timestamptz
        GROUP BY u.id, u.display_name, u.unique_id
        ORDER BY credited_minor DESC, topups DESC, u.display_name ASC
        LIMIT ${TOP_PAYERS}`),
    ]);

    const s = statRows[0];
    const payers = s?.payers ?? 0;
    const topups = s?.topups ?? 0;
    const uniminutes = Math.round(num(s?.credited_minor) / MINOR_PER_UNIMINUTE);
    const newPayers = s?.new_payers ?? 0;

    const packMap = new Map<number, MoneyPack>();
    for (const r of packRows) {
      const pack = packMap.get(r.uniminutes) ?? {
        uniminutes: r.uniminutes,
        count: 0,
        share: 0,
        paidMinor: 0,
        byPlatform: perPlatform(),
      };
      pack.count += r.topups;
      pack.paidMinor += num(r.paid_minor);
      if (isTopupPlatform(r.platform)) pack.byPlatform[r.platform] += r.topups;
      packMap.set(r.uniminutes, pack);
    }
    const packs = [...packMap.values()]
      .sort((a, b) => a.uniminutes - b.uniminutes)
      .map((p) => ({ ...p, share: topups > 0 ? p.count / topups : 0 }));

    return {
      stats: {
        payers,
        newPayers,
        returningPayers: payers - newPayers,
        repeatInRange: s?.repeat_in_range ?? 0,
        topups,
        uniminutes,
        paidMinor: num(s?.paid_minor),
        averageUniminutes:
          topups > 0 ? Math.round((uniminutes / topups) * 10) / 10 : null,
        payersEver: s?.payers_ever ?? 0,
        repeatEver: s?.repeat_ever ?? 0,
        aspirants: s?.aspirants ?? 0,
      },
      packs,
      topPayers: topRows.map((r) => ({
        userId: r.id,
        name: r.display_name,
        uniqueId: r.unique_id,
        topups: r.topups,
        uniminutes: Math.round(num(r.credited_minor) / MINOR_PER_UNIMINUTE),
        paidMinor: num(r.paid_minor),
        platforms: (r.platforms ?? '').split(',').filter(isTopupPlatform),
        lastAt: r.last_at.toISOString(),
      })),
    };
  }

  /** What aspirants and mentors hold, where it came from, and which mentors
   * are owed money and for how long. All time — a balance has no range. */
  async balances(now: Date = new Date()): Promise<MoneyBalances> {
    const [kindRows, walletRows, owedRows] = await Promise.all([
      this.prisma.$queryRaw<KindRow[]>(Prisma.sql`
        WITH ${TOPUPS_CTE_SQL}
        SELECT u.role::text AS role,
               CASE
                 WHEN le.type = 'TOPUP' THEN CASE WHEN t.is_payment THEN 'BOUGHT' ELSE 'TEST_CREDIT' END
                 WHEN le.type = 'SESSION_CREDIT' AND le.session_id IS NULL THEN 'MANUAL_EARNINGS'
                 ELSE le.type::text
               END AS kind,
               COUNT(*)::int AS entries,
               COALESCE(SUM(le.amount_minor), 0)::bigint AS sum_minor
        FROM ledger_entries le
        JOIN wallets w ON w.id = le.wallet_id
        JOIN users u ON u.id = w.user_id
        LEFT JOIN topups t ON t.id = le.id
        WHERE u.role IN ('ASPIRANT', 'MENTOR')
        GROUP BY 1, 2`),
      this.prisma.$queryRaw<WalletTotalRow[]>(Prisma.sql`
        SELECT u.role::text AS role,
               COUNT(*) FILTER (WHERE w.balance_minor > 0)::int AS wallets,
               COALESCE(SUM(w.balance_minor), 0)::bigint AS balance_minor
        FROM wallets w
        JOIN users u ON u.id = w.user_id
        WHERE u.role IN ('ASPIRANT', 'MENTOR')
        GROUP BY 1`),
      this.prisma.$queryRaw<OwedMentorRow[]>(Prisma.sql`
        SELECT u.id,
               u.display_name,
               u.unique_id,
               w.balance_minor,
               lp.last_payout_at,
               os.owed_since
        FROM users u
        JOIN wallets w ON w.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT MAX(e.created_at) AS last_payout_at
          FROM ledger_entries e WHERE e.wallet_id = w.id AND e.type = 'PAYOUT'
        ) lp ON true
        LEFT JOIN LATERAL (
          SELECT MIN(e.created_at) AS owed_since
          FROM ledger_entries e
          WHERE e.wallet_id = w.id AND e.type = 'SESSION_CREDIT'
            AND e.created_at > COALESCE(lp.last_payout_at, '-infinity'::timestamptz)
        ) os ON true
        WHERE u.role = 'MENTOR' AND w.balance_minor > 0
        ORDER BY w.balance_minor DESC, u.display_name ASC
        LIMIT ${OWED_MENTORS}`),
    ]);

    const breakdown = (role: string): MoneyBalanceBreakdown => {
      const wallet = walletRows.find((r) => r.role === role);
      const lines = kindRows
        .filter((r) => r.role === role)
        .map((r) => ({
          kind: r.kind as BalanceKind,
          entries: r.entries,
          minor: num(r.sum_minor),
        }))
        .sort((a, b) => Math.abs(b.minor) - Math.abs(a.minor));
      const balanceMinor = num(wallet?.balance_minor);
      return {
        wallets: wallet?.wallets ?? 0,
        balanceMinor,
        lines,
        unexplainedMinor: balanceMinor - lines.reduce((s, l) => s + l.minor, 0),
      };
    };

    return {
      aspirants: breakdown('ASPIRANT'),
      mentors: breakdown('MENTOR'),
      owedMentors: owedRows.map((r) => ({
        id: r.id,
        name: r.display_name,
        uniqueId: r.unique_id,
        balanceMinor: r.balance_minor,
        lastPayoutAt: r.last_payout_at?.toISOString() ?? null,
        owedSince: r.owed_since?.toISOString() ?? null,
        daysOwed: r.owed_since
          ? Math.max(
              0,
              Math.floor((now.getTime() - r.owed_since.getTime()) / DAY_MS),
            )
          : null,
      })),
    };
  }

  /** What happened to call requests in the range: how many ended in a billed
   * call, and how the rest ended. */
  async usage(query: MetricsQueryDto): Promise<MoneyUsage> {
    const w = resolveMoneyRange(query);
    const inRange = Prisma.sql`s.type = 'AUDIO_CALL'
      AND s.requested_at >= ${w.since}::timestamptz
      AND s.requested_at < ${w.until}::timestamptz`;
    const [outcomeRows, peopleRows] = await Promise.all([
      this.prisma.$queryRaw<OutcomeRow[]>(Prisma.sql`
        SELECT CASE
                 WHEN s.billed_minutes > 0 THEN 'billed'
                 WHEN s.status = 'REJECTED' THEN 'declined'
                 WHEN s.status = 'CANCELLED' THEN 'cancelled'
                 WHEN s.end_reason = 'ASPIRANT_NO_SHOW' THEN 'aspirant_no_show'
                 WHEN s.end_reason = 'MENTOR_NO_SHOW' THEN 'mentor_no_show'
                 WHEN s.status IN ('PENDING', 'ACCEPTED', 'RINGING', 'IN_PROGRESS') THEN 'open'
                 ELSE 'not_connected'
               END AS outcome,
               COUNT(*)::int AS sessions,
               COALESCE(SUM(s.billed_minutes), 0)::bigint AS billed_minutes,
               COALESCE(SUM(s.total_cost_minor), 0)::bigint AS cost_minor
        FROM sessions s
        WHERE ${inRange}
        GROUP BY 1`),
      this.prisma.$queryRaw<UsagePeopleRow[]>(Prisma.sql`
        SELECT COUNT(DISTINCT s.aspirant_id)::int AS callers,
               COUNT(DISTINCT s.mentor_id) FILTER (WHERE s.billed_minutes > 0)::int AS mentors_called
        FROM sessions s
        WHERE ${inRange}`),
    ]);

    const outcomes = USAGE_OUTCOMES.map((outcome) => {
      const r = outcomeRows.find((o) => o.outcome === outcome);
      return {
        outcome,
        count: r?.sessions ?? 0,
        minutes: num(r?.billed_minutes),
        costMinor: num(r?.cost_minor),
      };
    });
    const requested = outcomes.reduce((s, o) => s + o.count, 0);
    const billed = outcomes.find((o) => o.outcome === 'billed')!;
    return {
      range: w.range,
      days: w.days,
      requested,
      billedCalls: billed.count,
      billedMinutes: billed.minutes,
      billedCostMinor: billed.costMinor,
      averageBilledMinutes:
        billed.count > 0
          ? Math.round((billed.minutes / billed.count) * 10) / 10
          : null,
      billedShare: requested > 0 ? billed.count / requested : null,
      callers: peopleRows[0]?.callers ?? 0,
      mentorsCalled: peopleRows[0]?.mentors_called ?? 0,
      outcomes,
    };
  }
}
