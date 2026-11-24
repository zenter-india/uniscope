import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { MetricsQueryDto } from '../metrics/dto/metrics-query.dto.js';
import { TOPUP_PLATFORMS, isTopupPlatform } from '../wallet/topup-platform.js';
import type { TopupPlatform } from '../wallet/topup-platform.js';
import { ListTopupsDto } from './dto/list-topups.dto.js';
import { toCsv } from './money-csv.js';
import { resolveMoneyRange, type MoneyRange } from './money-range.js';
import { TOPUPS_CTE_SQL } from './money-sql.js';

const DEFAULT_TOPUP_LIMIT = 25;
/** An export is the whole table for the range, but not unbounded. */
const EXPORT_ROWS = 10_000;
const MENTOR_ROWS = 1_000;
/** 1 Uniminute = 1000 minor units (₹10) = one minute of call time. */
const MINOR_PER_UNIMINUTE = 1000;

type Big = bigint | number;
const num = (v: Big | null | undefined): number => (v == null ? 0 : Number(v));
const rupees = (minor: number): number => minor / 100;

interface TopupAggRow {
  is_payment: boolean;
  platform: string | null;
  topups: number;
  users: number;
  credited_minor: Big;
  paid_minor: Big;
  paid_known: number;
}
interface FlowRow {
  type: string;
  /** True for an entry not tied to a call (a manual credit, not earnings). */
  no_session: boolean;
  entries: number;
  wallets: number;
  sessions: number;
  sum_minor: Big;
  credits_minor: Big;
  debits_minor: Big;
}
interface OwedRow {
  owed_minor: Big;
  mentors: number;
}
interface TopupRow {
  id: string;
  created_at: Date;
  cursor_ts: string;
  amount_minor: number;
  platform: string | null;
  paid_minor: number | null;
  user_id: string;
  display_name: string;
  unique_id: string | null;
  role: string;
}
interface MentorRow {
  id: string;
  display_name: string;
  unique_id: string | null;
  earned_minor: Big;
  sessions: number;
  paid_out_minor: Big;
  balance_minor: number;
}

export interface MoneyPlatformSummary {
  platform: TopupPlatform;
  count: number;
  users: number;
  uniminutes: number;
  /** Rupees paid, in paise: Razorpay payments and Apple purchases (Apple sends
   * the price with each one). Left out only when a price is genuinely unknown. */
  paidMinor: number;
  /** How many of `count` carry a known price. */
  paidKnown: number;
}

/** The headline numbers of one period, for the comparison with the one before. */
export interface MoneyPeriodTotals {
  topups: { count: number; uniminutes: number; paidMinor: number };
  mentorEarnedMinor: number;
  payoutsPaidMinor: number;
}

export interface MoneySummary {
  range: { from: string; to: string } | null;
  days: number;
  topups: {
    /** Real payments only, all platforms together. */
    count: number;
    uniminutes: number;
    paidMinor: number;
    /** Always android, ios and web, in that order. */
    byPlatform: MoneyPlatformSummary[];
    /** TOPUP credits that were not real payments — test or manual credits,
     * Apple's test-mode ("Sandbox") purchases, refunded purchases. Kept out of
     * everything above so "money in" is only money, but shown so the page still
     * adds up to the ledger. */
    notPayments: { count: number; uniminutes: number };
  };
  /** Earned from calls. */
  mentorEarnings: { earnedMinor: number; sessions: number; mentors: number };
  /** Credits to a mentor that were not for a call (manual test earnings). */
  manualEarnings: { count: number; minor: number };
  payoutsPaidMinor: number;
  refundsMinor: number;
  /** Admin-made balance changes — not revenue, so kept on their own line. */
  adjustments: { count: number; creditsMinor: number; debitsMinor: number };
  /** Not a flow: what mentors hold in their wallets right now. */
  mentorBalanceMinor: number;
  mentorsOwed: number;
  /** The equally long period right before, for the comparison. */
  previous: MoneyPeriodTotals;
}

export interface MoneyTopup {
  id: string;
  createdAt: string;
  userId: string;
  userName: string;
  uniqueId: string | null;
  role: string;
  platform: TopupPlatform | null;
  uniminutes: number;
  /** Paise paid; null only when the price is genuinely unknown. */
  paidMinor: number | null;
}

export interface MoneyMentor {
  id: string;
  name: string;
  uniqueId: string | null;
  sessions: number;
  minutes: number;
  earnedMinor: number;
  paidOutMinor: number;
  balanceMinor: number;
}

/** How earnings are spread across mentors in the range. */
export interface MoneyMentorStats {
  mentorsEarning: number;
  totalEarnedMinor: number;
  /** Share (0..1) of all earnings that went to the top one / top three. */
  topOneShare: number | null;
  topThreeShare: number | null;
  /** Earned per call, in paise. */
  averagePerCallMinor: number | null;
}

const CURSOR_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

function encodeCursor(row: TopupRow): string {
  return Buffer.from(JSON.stringify({ t: row.cursor_ts, id: row.id })).toString(
    'base64url',
  );
}

function decodeCursor(cursor: string): { t: string; id: string } {
  try {
    const v = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      t?: unknown;
      id?: unknown;
    };
    if (
      typeof v.t === 'string' &&
      CURSOR_TS.test(v.t) &&
      typeof v.id === 'string' &&
      v.id.length > 0 &&
      v.id.length <= 64
    ) {
      return { t: v.t, id: v.id };
    }
  } catch {
    // fall through
  }
  throw new BadRequestException('That page link is not valid.');
}

/** Top-up rows of one period → the three platforms, the totals and the credits
 * that were not real payments. */
function foldTopups(rows: TopupAggRow[]) {
  // Always the three platforms, so the page never has a gap.
  const byPlatform: MoneyPlatformSummary[] = TOPUP_PLATFORMS.map((p) => ({
    platform: p,
    count: 0,
    users: 0,
    uniminutes: 0,
    paidMinor: 0,
    paidKnown: 0,
  }));
  const notPayments = { count: 0, uniminutes: 0 };
  for (const r of rows) {
    const uniminutes = Math.round(num(r.credited_minor) / MINOR_PER_UNIMINUTE);
    const slot = isTopupPlatform(r.platform)
      ? byPlatform.find((p) => p.platform === r.platform)
      : undefined;
    if (!r.is_payment || !slot) {
      notPayments.count += r.topups;
      notPayments.uniminutes += uniminutes;
      continue;
    }
    slot.count += r.topups;
    slot.users += r.users;
    slot.uniminutes += uniminutes;
    slot.paidMinor += num(r.paid_minor);
    slot.paidKnown += r.paid_known;
  }
  return {
    byPlatform,
    notPayments,
    count: byPlatform.reduce((s, p) => s + p.count, 0),
    uniminutes: byPlatform.reduce((s, p) => s + p.uniminutes, 0),
    paidMinor: byPlatform.reduce((s, p) => s + p.paidMinor, 0),
  };
}

/** Ledger flow rows of one period → earnings, payouts, refunds, adjustments. */
function foldFlows(rows: FlowRow[]) {
  const of = (type: string) => rows.filter((r) => r.type === type);
  const total = (type: string) =>
    of(type).reduce((s, r) => s + num(r.sum_minor), 0);
  const credits = of('SESSION_CREDIT');
  const forCalls = credits.find((r) => !r.no_session);
  const manual = credits.find((r) => r.no_session);
  const adjust = of('ADJUSTMENT');
  return {
    earned: {
      earnedMinor: num(forCalls?.sum_minor),
      sessions: forCalls?.sessions ?? 0,
      mentors: forCalls?.wallets ?? 0,
    },
    manualEarnings: {
      count: manual?.entries ?? 0,
      minor: num(manual?.sum_minor),
    },
    payoutsPaidMinor: Math.abs(total('PAYOUT')),
    refundsMinor: total('REFUND'),
    adjustments: {
      count: adjust.reduce((s, r) => s + r.entries, 0),
      creditsMinor: adjust.reduce((s, r) => s + num(r.credits_minor), 0),
      debitsMinor: Math.abs(
        adjust.reduce((s, r) => s + num(r.debits_minor), 0),
      ),
    },
  };
}

/** Read-only money reporting for the admin Money page. Everything comes from
 * the append-only ledger, so these numbers can never disagree with a wallet. */
@Injectable()
export class MoneyService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: MetricsQueryDto): Promise<MoneySummary> {
    const w = resolveMoneyRange(query);
    const [topupRows, flowRows, prevTopupRows, prevFlowRows, owedRows] =
      await Promise.all([
        this.topupAggregate(w.since, w.until),
        this.flowAggregate(w.since, w.until),
        this.topupAggregate(w.previous.since, w.previous.until),
        this.flowAggregate(w.previous.since, w.previous.until),
        this.prisma.$queryRaw<OwedRow[]>(Prisma.sql`
          SELECT COALESCE(SUM(w.balance_minor), 0)::bigint AS owed_minor,
                 COUNT(*)::int AS mentors
          FROM wallets w
          JOIN users u ON u.id = w.user_id
          WHERE u.role = 'MENTOR' AND w.balance_minor > 0`),
      ]);

    const topups = foldTopups(topupRows);
    const flows = foldFlows(flowRows);
    const prevTopups = foldTopups(prevTopupRows);
    const prevFlows = foldFlows(prevFlowRows);

    return {
      range: w.range,
      days: w.days,
      topups: {
        count: topups.count,
        uniminutes: topups.uniminutes,
        paidMinor: topups.paidMinor,
        byPlatform: topups.byPlatform,
        notPayments: topups.notPayments,
      },
      mentorEarnings: flows.earned,
      manualEarnings: flows.manualEarnings,
      payoutsPaidMinor: flows.payoutsPaidMinor,
      refundsMinor: flows.refundsMinor,
      adjustments: flows.adjustments,
      mentorBalanceMinor: num(owedRows[0]?.owed_minor),
      mentorsOwed: owedRows[0]?.mentors ?? 0,
      previous: {
        topups: {
          count: prevTopups.count,
          uniminutes: prevTopups.uniminutes,
          paidMinor: prevTopups.paidMinor,
        },
        mentorEarnedMinor: prevFlows.earned.earnedMinor,
        payoutsPaidMinor: prevFlows.payoutsPaidMinor,
      },
    };
  }

  /** One page of top-ups, newest first. */
  async listTopups(
    query: ListTopupsDto,
  ): Promise<{ data: MoneyTopup[]; nextCursor: string | null }> {
    const limit = query.limit ?? DEFAULT_TOPUP_LIMIT;
    const rows = await this.topupRows(
      resolveMoneyRange(query),
      query,
      limit + 1,
    );
    const page = rows.slice(0, limit);
    return {
      data: page.map(toTopup),
      nextCursor:
        rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
    };
  }

  /** Every top-up in the range that matches the filters, as a CSV. */
  async exportTopupsCsv(query: ListTopupsDto): Promise<string> {
    const rows = await this.topupRows(
      resolveMoneyRange(query),
      { ...query, cursor: undefined },
      EXPORT_ROWS,
    );
    return toCsv(rows.map(toTopup), [
      ['Date (UTC)', (t) => t.createdAt],
      ['User', (t) => t.userName],
      ['User ID', (t) => t.uniqueId],
      ['Role', (t) => t.role],
      ['Platform', (t) => t.platform ?? 'unknown'],
      ['Uniminutes credited', (t) => t.uniminutes],
      [
        'Paid (INR)',
        (t) => (t.paidMinor === null ? null : rupees(t.paidMinor)),
      ],
    ]);
  }

  /** Mentors with earnings or payouts in the range, biggest earner first, and
   * how earnings are spread across them. */
  async mentors(query: MetricsQueryDto): Promise<{
    data: MoneyMentor[];
    truncated: boolean;
    stats: MoneyMentorStats;
  }> {
    const w = resolveMoneyRange(query);
    const rows = await this.mentorRows(w, MENTOR_ROWS + 1);
    const data = rows.slice(0, MENTOR_ROWS).map(toMentor);
    return {
      data,
      truncated: rows.length > MENTOR_ROWS,
      stats: mentorStats(data),
    };
  }

  async exportMentorsCsv(query: MetricsQueryDto): Promise<string> {
    const rows = await this.mentorRows(resolveMoneyRange(query), EXPORT_ROWS);
    return toCsv(rows.map(toMentor), [
      ['Mentor', (m) => m.name],
      ['User ID', (m) => m.uniqueId],
      ['Calls', (m) => m.sessions],
      ['Minutes', (m) => m.minutes],
      ['Earned (INR)', (m) => rupees(m.earnedMinor)],
      ['Paid out (INR)', (m) => rupees(m.paidOutMinor)],
      ['Balance now (INR)', (m) => rupees(m.balanceMinor)],
    ]);
  }

  /** Top-ups of one period by platform; `is_payment` splits real money from
   * test and refunded credits. */
  private topupAggregate(since: Date, until: Date): Promise<TopupAggRow[]> {
    return this.prisma.$queryRaw<TopupAggRow[]>(Prisma.sql`
      WITH ${TOPUPS_CTE_SQL}
      SELECT t.is_payment AS is_payment,
             t.platform AS platform,
             COUNT(*)::int AS topups,
             COUNT(DISTINCT t.user_id)::int AS users,
             COALESCE(SUM(t.amount_minor), 0)::bigint AS credited_minor,
             COALESCE(SUM(t.paid_minor), 0)::bigint AS paid_minor,
             COUNT(t.paid_minor)::int AS paid_known
      FROM topups t
      WHERE t.created_at >= ${since}::timestamptz
        AND t.created_at < ${until}::timestamptz
      GROUP BY t.is_payment, t.platform`);
  }

  /** Mentor earnings, payouts, refunds and admin adjustments of one period. A
   * mentor credit with no call behind it (a manual test credit) is kept apart
   * from earnings. */
  private flowAggregate(since: Date, until: Date): Promise<FlowRow[]> {
    return this.prisma.$queryRaw<FlowRow[]>(Prisma.sql`
      SELECT le.type::text AS type,
             (le.session_id IS NULL) AS no_session,
             COUNT(*)::int AS entries,
             COUNT(DISTINCT le.wallet_id)::int AS wallets,
             COUNT(DISTINCT le.session_id)::int AS sessions,
             COALESCE(SUM(le.amount_minor), 0)::bigint AS sum_minor,
             COALESCE(SUM(le.amount_minor) FILTER (WHERE le.amount_minor > 0), 0)::bigint AS credits_minor,
             COALESCE(SUM(le.amount_minor) FILTER (WHERE le.amount_minor < 0), 0)::bigint AS debits_minor
      FROM ledger_entries le
      WHERE le.type IN ('SESSION_CREDIT', 'PAYOUT', 'REFUND', 'ADJUSTMENT')
        AND le.created_at >= ${since}::timestamptz
        AND le.created_at < ${until}::timestamptz
      GROUP BY le.type, (le.session_id IS NULL)`);
  }

  private topupRows(
    w: MoneyRange,
    f: Pick<ListTopupsDto, 'platform' | 'q' | 'cursor'>,
    take: number,
  ): Promise<TopupRow[]> {
    const platform = f.platform
      ? Prisma.sql`AND t.platform = ${f.platform}`
      : Prisma.empty;
    // Plain substring / prefix tests, not LIKE: a "%" or "_" typed into the
    // search box must mean itself.
    const search = f.q
      ? Prisma.sql`AND (strpos(lower(u.display_name), lower(${f.q})) > 0
          OR strpos(upper(COALESCE(u.unique_id, '')), upper(${f.q})) = 1)`
      : Prisma.empty;
    let after = Prisma.empty;
    if (f.cursor) {
      const c = decodeCursor(f.cursor);
      after = Prisma.sql`AND (t.created_at, t.id) < (${c.t}::timestamptz, ${c.id})`;
    }
    return this.prisma.$queryRaw<TopupRow[]>(Prisma.sql`
      WITH ${TOPUPS_CTE_SQL}
      SELECT t.id,
             t.created_at,
             to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts,
             t.amount_minor,
             t.platform AS platform,
             t.paid_minor AS paid_minor,
             u.id AS user_id,
             u.display_name,
             u.unique_id,
             u.role::text AS role
      FROM topups t
      JOIN users u ON u.id = t.user_id
      WHERE t.is_payment
        AND t.created_at >= ${w.since}::timestamptz
        AND t.created_at < ${w.until}::timestamptz
        ${platform} ${search} ${after}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${take}`);
  }

  private mentorRows(w: MoneyRange, take: number): Promise<MentorRow[]> {
    // "Earned" is only credits for a call (session_id set): a manual test
    // credit has none and must not pass as earnings.
    return this.prisma.$queryRaw<MentorRow[]>(Prisma.sql`
      SELECT u.id,
             u.display_name,
             u.unique_id,
             COALESCE(SUM(le.amount_minor) FILTER (WHERE le.type = 'SESSION_CREDIT' AND le.session_id IS NOT NULL), 0)::bigint AS earned_minor,
             COUNT(DISTINCT le.session_id) FILTER (WHERE le.type = 'SESSION_CREDIT')::int AS sessions,
             COALESCE(SUM(-le.amount_minor) FILTER (WHERE le.type = 'PAYOUT'), 0)::bigint AS paid_out_minor,
             w.balance_minor AS balance_minor
      FROM users u
      JOIN wallets w ON w.user_id = u.id
      JOIN ledger_entries le ON le.wallet_id = w.id
        AND le.type IN ('SESSION_CREDIT', 'PAYOUT')
        AND le.created_at >= ${w.since}::timestamptz
        AND le.created_at < ${w.until}::timestamptz
      WHERE u.role = 'MENTOR'
      GROUP BY u.id, u.display_name, u.unique_id, w.balance_minor
      HAVING COALESCE(SUM(le.amount_minor) FILTER (WHERE le.type = 'SESSION_CREDIT' AND le.session_id IS NOT NULL), 0) > 0
          OR COALESCE(SUM(-le.amount_minor) FILTER (WHERE le.type = 'PAYOUT'), 0) > 0
      ORDER BY earned_minor DESC, paid_out_minor DESC, u.display_name ASC
      LIMIT ${take}`);
  }
}

function toTopup(r: TopupRow): MoneyTopup {
  return {
    id: r.id,
    createdAt: r.created_at.toISOString(),
    userId: r.user_id,
    userName: r.display_name,
    uniqueId: r.unique_id,
    role: r.role,
    platform: isTopupPlatform(r.platform) ? r.platform : null,
    uniminutes: Math.round(r.amount_minor / MINOR_PER_UNIMINUTE),
    paidMinor: r.paid_minor,
  };
}

function toMentor(r: MentorRow): MoneyMentor {
  const earnedMinor = num(r.earned_minor);
  return {
    id: r.id,
    name: r.display_name,
    uniqueId: r.unique_id,
    sessions: r.sessions,
    minutes: Math.round(earnedMinor / MINOR_PER_UNIMINUTE),
    earnedMinor,
    paidOutMinor: num(r.paid_out_minor),
    balanceMinor: r.balance_minor,
  };
}

/** `rows` are already biggest earner first. */
export function mentorStats(rows: MoneyMentor[]): MoneyMentorStats {
  const earning = rows.filter((m) => m.earnedMinor > 0);
  const total = earning.reduce((s, m) => s + m.earnedMinor, 0);
  const calls = earning.reduce((s, m) => s + m.sessions, 0);
  const share = (n: number) =>
    total > 0
      ? earning.slice(0, n).reduce((s, m) => s + m.earnedMinor, 0) / total
      : null;
  return {
    mentorsEarning: earning.length,
    totalEarnedMinor: total,
    topOneShare: share(1),
    topThreeShare: share(3),
    averagePerCallMinor: calls > 0 ? Math.round(total / calls) : null,
  };
}
