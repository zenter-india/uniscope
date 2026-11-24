// What the backend's /admin/money routes return. Amounts are in paise ("minor"
// units) unless a field says Uniminutes; 1 Uniminute = 1000 paise = ₹10.

export type Platform = 'android' | 'ios' | 'web';
export type BucketUnit = 'day' | 'week' | 'month';

export interface MoneyPlatformSummary {
  platform: Platform;
  count: number;
  users: number;
  uniminutes: number;
  /** Paise paid: Razorpay payments and Apple purchases (Apple sends the price
   * with each one). Left out only when a price is genuinely unknown. */
  paidMinor: number;
  /** How many of `count` carry a known price. */
  paidKnown: number;
}

export interface MoneyPeriodTotals {
  topups: { count: number; uniminutes: number; paidMinor: number };
  mentorEarnedMinor: number;
  payoutsPaidMinor: number;
}

export interface MoneySummary {
  range: { from: string; to: string } | null;
  days: number;
  topups: {
    count: number;
    uniminutes: number;
    paidMinor: number;
    byPlatform: MoneyPlatformSummary[];
    /** Credits that were not real payments (test, Apple test-mode, refunded). */
    notPayments: { count: number; uniminutes: number };
  };
  mentorEarnings: { earnedMinor: number; sessions: number; mentors: number };
  /** Mentor credits not tied to a call (manual test earnings). */
  manualEarnings: { count: number; minor: number };
  payoutsPaidMinor: number;
  refundsMinor: number;
  adjustments: { count: number; creditsMinor: number; debitsMinor: number };
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
  platform: Platform | null;
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

export interface MoneyMentorStats {
  mentorsEarning: number;
  totalEarnedMinor: number;
  topOneShare: number | null;
  topThreeShare: number | null;
  averagePerCallMinor: number | null;
}

export interface MoneyMentors {
  data: MoneyMentor[];
  truncated: boolean;
  stats: MoneyMentorStats;
}

export interface MoneyTrendPoint {
  /** `YYYY-MM-DD`, the UTC start of the day, week or month. */
  bucket: string;
  topups: number;
  paidMinor: number;
  paidByPlatformMinor: Record<Platform, number>;
  uniminutes: Record<Platform, number>;
  mentorEarnedMinor: number;
  calls: number;
  minutes: number;
}

export interface MoneyTrend {
  unit: BucketUnit;
  points: MoneyTrendPoint[];
}

export interface MoneyPack {
  uniminutes: number;
  count: number;
  share: number;
  paidMinor: number;
  byPlatform: Record<Platform, number>;
}

export interface MoneyTopPayer {
  userId: string;
  name: string;
  uniqueId: string | null;
  topups: number;
  uniminutes: number;
  paidMinor: number;
  platforms: Platform[];
  lastAt: string;
}

export interface MoneyPayers {
  stats: {
    payers: number;
    newPayers: number;
    returningPayers: number;
    repeatInRange: number;
    topups: number;
    uniminutes: number;
    paidMinor: number;
    averageUniminutes: number | null;
    payersEver: number;
    repeatEver: number;
    aspirants: number;
  };
  packs: MoneyPack[];
  topPayers: MoneyTopPayer[];
}

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
  wallets: number;
  balanceMinor: number;
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
  owedSince: string | null;
  daysOwed: number | null;
}

export interface MoneyBalances {
  aspirants: MoneyBalanceBreakdown;
  mentors: MoneyBalanceBreakdown;
  owedMentors: MoneyOwedMentor[];
}

export type UsageOutcome =
  | 'billed'
  | 'declined'
  | 'cancelled'
  | 'aspirant_no_show'
  | 'mentor_no_show'
  | 'not_connected'
  | 'open';

export interface MoneyUsage {
  range: { from: string; to: string } | null;
  days: number;
  requested: number;
  billedCalls: number;
  billedMinutes: number;
  billedCostMinor: number;
  averageBilledMinutes: number | null;
  billedShare: number | null;
  callers: number;
  mentorsCalled: number;
  outcomes: {
    outcome: UsageOutcome;
    count: number;
    minutes: number;
    costMinor: number;
  }[];
}

/** What the page's address can carry. */
export interface MoneyQuery {
  days?: number;
  from?: string;
  to?: string;
  platform?: Platform;
  q?: string;
}
