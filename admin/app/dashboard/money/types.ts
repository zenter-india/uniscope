// What the backend's /admin/money routes return. Amounts are in paise ("minor"
// units) unless a field says Uniminutes; 1 Uniminute = 1000 paise = ₹10.

export type Platform = 'android' | 'ios' | 'web';

export interface MoneyPlatformSummary {
  platform: Platform;
  count: number;
  users: number;
  uniminutes: number;
  /** Paise paid. Only top-ups that record a price (Razorpay) add to this. */
  paidMinor: number;
  /** How many of `count` carry a recorded price. */
  paidKnown: number;
}

export interface MoneySummary {
  range: { from: string; to: string } | null;
  days: number;
  topups: {
    count: number;
    uniminutes: number;
    paidMinor: number;
    byPlatform: MoneyPlatformSummary[];
    /** Test or manual credits: in the ledger, but not payments. */
    notPayments: { count: number; uniminutes: number };
  };
  mentorEarnings: { earnedMinor: number; sessions: number; mentors: number };
  payoutsPaidMinor: number;
  refundsMinor: number;
  adjustments: { count: number; creditsMinor: number; debitsMinor: number };
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
  platform: Platform | null;
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

/** What the page's address can carry. */
export interface MoneyQuery {
  days?: number;
  from?: string;
  to?: string;
  platform?: Platform;
  q?: string;
}
