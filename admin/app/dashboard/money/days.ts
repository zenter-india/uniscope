import type { MoneyQuery, Platform } from './types';

// The same day rules as the Overview (app/dashboard/page.tsx): a rolling 24h /
// 7d / 30d / 90d window, or a custom range of whole UTC days.
export const RANGES = [1, 7, 30, 90] as const;
export const PLATFORMS: readonly Platform[] = ['ios', 'android', 'web'];
// Lives here, not in TopupsTable.tsx: that file is browser-only ('use client'),
// and a server page importing a plain value from it gets an empty reference.
export const PLATFORM_LABEL: Record<Platform, string> = {
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
};

/** 1 is the rolling last 24 hours, not a calendar day. */
export const rangeLabel = (d: number) => (d === 1 ? '24h' : `${d}d`);
export const windowLabel = (d: number) =>
  d === 1 ? 'the last 24 hours' : `the last ${d} days`;

const DAY_MS = 86_400_000;
export const todayUtc = () => new Date().toISOString().slice(0, 10);

/** A real calendar day written YYYY-MM-DD (rejects e.g. 2026-02-31). */
export function isRealDay(v: string | undefined | null): v is string {
  return (
    !!v &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
  );
}

export const shiftDay = (day: string, days: number) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

function fmtDay(day: string, withYear = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

/** "3 Nov – 9 Nov 2026", or just "3 Nov 2026" for a single day. */
export function fmtSpan(from: string, to: string): string {
  return from === to
    ? fmtDay(from, true)
    : `${fmtDay(from, from.slice(0, 4) !== to.slice(0, 4))} – ${fmtDay(to, true)}`;
}

/** A user erased for privacy is kept as a "deleted_user_<id>" stub; showing
 * that raw would look like a bug, so it reads as what it is. */
export const shownName = (name: string) =>
  name.startsWith('deleted_user_') ? 'Deleted account' : name;

/** Rupees from paise, no decimals (every amount here is a whole rupee). */
export function inr(minor: number): string {
  return (minor / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}

/** When a top-up happened, in UTC like the day ranges. */
export function fmtWhen(iso: string): string {
  return `${new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })} UTC`;
}

/** The screens of the Money page. */
export const TABS = ['overview', 'topups', 'payers'] as const;
export type Tab = (typeof TABS)[number];
export const TAB_LABEL: Record<Tab, string> = {
  overview: 'Overview',
  topups: 'Top-ups',
  payers: 'Payers & packs',
};
export const isTab = (v: string | undefined): v is Tab =>
  !!v && (TABS as readonly string[]).includes(v);

/**
 * The query string for the backend (and for links on this page) from the
 * page's address. Only known keys, each checked, so nothing else ever reaches
 * the API. A custom range wins over a preset, like on the Overview.
 */
export function moneyQueryString(q: MoneyQuery): string {
  const p = new URLSearchParams();
  if (isRealDay(q.from) && isRealDay(q.to)) {
    p.set('from', q.from);
    p.set('to', q.to);
  } else if (q.days && (RANGES as readonly number[]).includes(q.days)) {
    p.set('days', String(q.days));
  }
  if (q.platform && PLATFORMS.includes(q.platform)) p.set('platform', q.platform);
  const text = q.q?.trim().slice(0, 80);
  if (text) p.set('q', text);
  return p.toString();
}

/** A link to this page: the range and filters, and which screen. The screen is
 * for this page only — it is never sent to the backend. */
export function pageHref(q: MoneyQuery, tab: Tab): string {
  const p = new URLSearchParams(moneyQueryString(q));
  if (tab !== 'overview') p.set('tab', tab);
  const s = p.toString();
  return `/dashboard/money${s ? `?${s}` : ''}`;
}

/** Percent of a 0..1 share ("61%"), or a dash when there is nothing to divide. */
export const pct = (share: number | null, digits = 0): string =>
  share === null ? '—' : `${(share * 100).toFixed(digits)}%`;

export const nf = (n: number): string => n.toLocaleString('en-IN');

/** A day written YYYY-MM-DD for a chart label, or the day of an ISO time. */
export function fmtDate(iso: string, unit?: 'day' | 'week' | 'month'): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return unit === 'month'
    ? d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    : d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        ...(unit ? {} : { year: 'numeric' }),
        timeZone: 'UTC',
      });
}
