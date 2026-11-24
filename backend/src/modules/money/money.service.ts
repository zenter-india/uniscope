import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { MetricsQueryDto } from '../metrics/dto/metrics-query.dto.js';
import { TOPUP_PLATFORMS, isTopupPlatform } from '../wallet/topup-platform.js';
import type { TopupPlatform } from '../wallet/topup-platform.js';
import { ListTopupsDto } from './dto/list-topups.dto.js';
import { toCsv } from './money-csv.js';
import { resolveMoneyRange, type MoneyRange } from './money-range.js';
import {
  IS_PAYMENT_SQL,
  PAID_MINOR_SQL,
  TOPUP_PLATFORM_SQL,
} from './money-sql.js';

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
  platform: string | null;
  topups: number;
  users: number;
  credited_minor: Big;
  paid_minor: Big;
  paid_known: number;
}
interface FlowRow {
  type: string;
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
  /** Rupees paid, in paise — only for top-ups that record a price (Razorpay).
   * An Apple purchase has none: the App Store sets the price and keeps its cut. */
  paidMinor: number;
  /** How many of `count` carry a recorded price. */
  paidKnown: number;
}

export interface MoneySummary {
  range: { from: string; to: string } | null;
  days: number;
  topups: {
    /** Real payments only (Razorpay and Apple), all platforms together. */
    count: number;
    uniminutes: number;
    paidMinor: number;
    /** Always android, ios and web, in that order. */
    byPlatform: MoneyPlatformSummary[];
    /** TOPUP credits that were not payments — test or manual credits. Kept out
     * of everything above so "money in" is only money, but shown so the page
     * still adds up to the ledger. */
    notPayments: { count: number; uniminutes: number };
  };
  mentorEarnings: { earnedMinor: number; sessions: number; mentors: number };
  payoutsPaidMinor: number;
  refundsMinor: number;
  /** Admin-made balance changes — not revenue, so kept on their own line. */
  adjustments: { count: number; creditsMinor: number; debitsMinor: number };
  /** Not a flow: what mentors hold in their wallets right now. */
  mentorBalanceMinor: number;
  mentorsOwed: number;
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
  /** Paise paid; null when the price is not recorded (Apple purchases). */
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

/** Read-only money reporting for the admin Money page. Everything comes from
 * the append-only ledger, so these numbers can never disagree with a wallet. */
@Injectable()
export class MoneyService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: MetricsQueryDto): Promise<MoneySummary> {
    const w = resolveMoneyRange(query);
    const inRange = Prisma.sql`le.created_at >= ${w.since}::timestamptz AND le.created_at < ${w.until}::timestamptz`;

    const [topupRows, flowRows, owedRows] = await Promise.all([
      this.prisma.$queryRaw<TopupAggRow[]>(Prisma.sql`
        SELECT ${TOPUP_PLATFORM_SQL} AS platform,
               COUNT(*)::int AS topups,
               COUNT(DISTINCT w.user_id)::int AS users,
               COALESCE(SUM(le.amount_minor), 0)::bigint AS credited_minor,
               COALESCE(SUM(${PAID_MINOR_SQL}), 0)::bigint AS paid_minor,
               COUNT(${PAID_MINOR_SQL})::int AS paid_known
        FROM ledger_entries le
        JOIN wallets w ON w.id = le.wallet_id
        WHERE le.type = 'TOPUP' AND ${inRange}
        GROUP BY 1`),
      this.prisma.$queryRaw<FlowRow[]>(Prisma.sql`
        SELECT le.type::text AS type,
               COUNT(*)::int AS entries,
               COUNT(DISTINCT le.wallet_id)::int AS wallets,
               COUNT(DISTINCT le.session_id)::int AS sessions,
               COALESCE(SUM(le.amount_minor), 0)::bigint AS sum_minor,
               COALESCE(SUM(le.amount_minor) FILTER (WHERE le.amount_minor > 0), 0)::bigint AS credits_minor,
               COALESCE(SUM(le.amount_minor) FILTER (WHERE le.amount_minor < 0), 0)::bigint AS debits_minor
        FROM ledger_entries le
        WHERE le.type IN ('SESSION_CREDIT', 'PAYOUT', 'REFUND', 'ADJUSTMENT')
          AND ${inRange}
        GROUP BY le.type`),
      this.prisma.$queryRaw<OwedRow[]>(Prisma.sql`
        SELECT COALESCE(SUM(w.balance_minor), 0)::bigint AS owed_minor,
               COUNT(*)::int AS mentors
        FROM wallets w
        JOIN users u ON u.id = w.user_id
        WHERE u.role = 'MENTOR' AND w.balance_minor > 0`),
    ]);

    // Always the three platforms, so the page never has a gap. A row with no
    // platform is a TOPUP credit that was not a payment (a test or manual
    // credit): it is counted on its own line, never as money in.
    const byPlatform: MoneyPlatformSummary[] = TOPUP_PLATFORMS.map((p) => ({
      platform: p,
      count: 0,
      users: 0,
      uniminutes: 0,
      paidMinor: 0,
      paidKnown: 0,
    }));
    const notPayments = { count: 0, uniminutes: 0 };
    for (const r of topupRows) {
      const uniminutes = Math.round(
        num(r.credited_minor) / MINOR_PER_UNIMINUTE,
      );
      const slot = byPlatform.find((p) => p.platform === r.platform);
      if (!slot || !isTopupPlatform(r.platform)) {
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

    const flow = (type: string) => flowRows.find((r) => r.type === type);
    const credit = flow('SESSION_CREDIT');
    const adjust = flow('ADJUSTMENT');

    return {
      range: w.range,
      days: w.days,
      topups: {
        count: byPlatform.reduce((s, p) => s + p.count, 0),
        uniminutes: byPlatform.reduce((s, p) => s + p.uniminutes, 0),
        paidMinor: byPlatform.reduce((s, p) => s + p.paidMinor, 0),
        byPlatform,
        notPayments,
      },
      mentorEarnings: {
        earnedMinor: num(credit?.sum_minor),
        sessions: credit?.sessions ?? 0,
        mentors: credit?.wallets ?? 0,
      },
      payoutsPaidMinor: Math.abs(num(flow('PAYOUT')?.sum_minor)),
      refundsMinor: num(flow('REFUND')?.sum_minor),
      adjustments: {
        count: adjust?.entries ?? 0,
        creditsMinor: num(adjust?.credits_minor),
        debitsMinor: Math.abs(num(adjust?.debits_minor)),
      },
      mentorBalanceMinor: num(owedRows[0]?.owed_minor),
      mentorsOwed: owedRows[0]?.mentors ?? 0,
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

  /** Mentors with earnings or payouts in the range, biggest earner first. */
  async mentors(
    query: MetricsQueryDto,
  ): Promise<{ data: MoneyMentor[]; truncated: boolean }> {
    const w = resolveMoneyRange(query);
    const rows = await this.mentorRows(w, MENTOR_ROWS + 1);
    return {
      data: rows.slice(0, MENTOR_ROWS).map(toMentor),
      truncated: rows.length > MENTOR_ROWS,
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

  private topupRows(
    w: MoneyRange,
    f: Pick<ListTopupsDto, 'platform' | 'q' | 'cursor'>,
    take: number,
  ): Promise<TopupRow[]> {
    const platform = f.platform
      ? Prisma.sql`AND ${TOPUP_PLATFORM_SQL} = ${f.platform}`
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
      after = Prisma.sql`AND (le.created_at, le.id) < (${c.t}::timestamptz, ${c.id})`;
    }
    return this.prisma.$queryRaw<TopupRow[]>(Prisma.sql`
      SELECT le.id,
             le.created_at,
             to_char(le.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts,
             le.amount_minor,
             ${TOPUP_PLATFORM_SQL} AS platform,
             ${PAID_MINOR_SQL} AS paid_minor,
             u.id AS user_id,
             u.display_name,
             u.unique_id,
             u.role::text AS role
      FROM ledger_entries le
      JOIN wallets w ON w.id = le.wallet_id
      JOIN users u ON u.id = w.user_id
      WHERE le.type = 'TOPUP'
        AND ${IS_PAYMENT_SQL}
        AND le.created_at >= ${w.since}::timestamptz
        AND le.created_at < ${w.until}::timestamptz
        ${platform} ${search} ${after}
      ORDER BY le.created_at DESC, le.id DESC
      LIMIT ${take}`);
  }

  private mentorRows(w: MoneyRange, take: number): Promise<MentorRow[]> {
    return this.prisma.$queryRaw<MentorRow[]>(Prisma.sql`
      SELECT u.id,
             u.display_name,
             u.unique_id,
             COALESCE(SUM(le.amount_minor) FILTER (WHERE le.type = 'SESSION_CREDIT'), 0)::bigint AS earned_minor,
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
