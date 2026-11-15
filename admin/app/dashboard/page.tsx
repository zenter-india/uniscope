import Link from 'next/link';
import { backendFetch } from '../../lib/backend';
import { getAdminEmail } from '../../lib/adminAuth';
import { Card, FilterTabs } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { CustomRangePicker } from './CustomRangePicker';
import { DashboardShell } from './DashboardShell';
import { MiniBarChart } from './MiniBarChart';

interface DashboardMetrics {
  rangeDays: number;
  /** The days picked for a custom range (UTC, inclusive); null for a preset. */
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
    payoutBacklogMinor: number;
    /** The same totals for the equally long window before this one. */
    previous?: {
      topupMinor: number;
      mentorEarningsMinor: number;
      refundsMinor: number;
      adjustmentsMinor: number;
      payoutsPaidMinor: number;
    };
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

const RANGES = [1, 7, 30, 90] as const;

/** 1 is the rolling last 24 hours, not a calendar day. */
const rangeLabel = (d: number) => (d === 1 ? '24h' : `${d}d`);
const windowLabel = (d: number) => (d === 1 ? 'last 24 hours' : `last ${d} days`);

const DAY_MS = 86_400_000;
const todayUtc = () => new Date().toISOString().slice(0, 10);

/** A real calendar day written YYYY-MM-DD (rejects e.g. 2026-02-31). */
function isRealDay(v: string | undefined): v is string {
  return (
    !!v &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
  );
}

const shiftDay = (day: string, days: number) =>
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
function fmtSpan(from: string, to: string): string {
  return from === to
    ? fmtDay(from, true)
    : `${fmtDay(from, fromYearDiffers(from, to))} – ${fmtDay(to, true)}`;
}
const fromYearDiffers = (from: string, to: string) => from.slice(0, 4) !== to.slice(0, 4);

function inr(minor: number): string {
  return (minor / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}

function Trend({
  current,
  previous,
  lowerIsBetter = false,
}: {
  current: number;
  previous: number;
  /** For things like refunds, where an increase is the bad direction. */
  lowerIsBetter?: boolean;
}) {
  if (previous === 0) {
    return <span className="text-xs text-zinc-400 dark:text-zinc-500">{current > 0 ? 'new' : 'no prior data'}</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span className="text-xs text-zinc-400 dark:text-zinc-500">flat vs prev</span>;
  const up = pct > 0;
  const good = lowerIsBetter ? !up : up;
  const TrendIcon = up ? Icon.trendUp : Icon.trendDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ${
        good ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
      }`}
    >
      <TrendIcon className="h-3 w-3" />
      {Math.abs(pct)}%
    </span>
  );
}

function StatCard({
  label,
  value,
  href,
  hint,
  icon,
  alert,
}: {
  label: string;
  value: React.ReactNode;
  href: string;
  hint?: string;
  icon: IconName;
  alert?: boolean;
}) {
  const IconCmp = Icon[icon];
  return (
    <Link
      href={href}
      className="group rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{label}</p>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            alert ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <IconCmp className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{hint}</p>}
    </Link>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: IconName;
  children: React.ReactNode;
}) {
  const IconCmp = icon ? Icon[icon] : null;
  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {IconCmp && <IconCmp className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />}
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{value}</p>
      {sub}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; from?: string; to?: string }>;
}) {
  const { days: rawDays, from: rawFrom, to: rawTo } = await searchParams;
  const today = todayUtc();

  // A custom range needs two real days, in order, not starting in the future;
  // anything else falls back to the 30-day preset instead of an error page.
  const custom =
    isRealDay(rawFrom) && isRealDay(rawTo) && rawFrom <= rawTo && rawFrom <= today
      ? { from: rawFrom, to: rawTo > today ? today : rawTo }
      : null;

  const days = RANGES.includes(Number(rawDays) as (typeof RANGES)[number])
    ? Number(rawDays)
    : 30;

  const [email, m] = await Promise.all([
    getAdminEmail(),
    backendFetch<DashboardMetrics>(
      custom
        ? `/admin/metrics?from=${custom.from}&to=${custom.to}`
        : `/admin/metrics?days=${days}`,
    ).catch(() => null),
  ]);

  // What the numbers are for, and what they are compared with.
  const shown = m?.range ?? custom;
  const span = m?.rangeDays ?? days;
  const windowText = shown ? fmtSpan(shown.from, shown.to) : windowLabel(days);
  const compareText = shown
    ? `the ${span === 1 ? 'day' : `${span} days`} before (${fmtSpan(
        shiftDay(shown.from, -span),
        shiftDay(shown.from, -1),
      )})`
    : days === 1
      ? 'the previous 24 hours'
      : `the previous ${days} days`;
  const prev = m?.revenue.previous;

  return (
    <DashboardShell title="Overview" email={email}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Range</span>
        <FilterTabs
          items={RANGES}
          current={custom ? null : (days as (typeof RANGES)[number])}
          hrefFor={(r) => `/dashboard?days=${r}`}
          labelFor={rangeLabel}
        />
        <CustomRangePicker
          key={custom ? `${custom.from}|${custom.to}` : 'preset'}
          from={custom?.from ?? ''}
          to={custom?.to ?? ''}
          today={today}
          label={custom ? fmtSpan(custom.from, custom.to) : ''}
        />
      </div>
      {m && (
        <p className="-mt-2 mb-5 text-xs text-zinc-500 dark:text-zinc-400">
          Showing {windowText}. Changes are compared with {compareText}.
        </p>
      )}

      {!m ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Metrics are unavailable right now — the backend didn&apos;t respond.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="New leads"
              value={m.queues.newLeads}
              href="/dashboard/leads?status=NEW"
              hint="Enrollment funnel"
              icon="users"
              alert={m.queues.newLeads > 0}
            />
            <StatCard
              label="Pending verifications"
              value={m.queues.pendingVerifications}
              href="/dashboard/verification"
              hint="Awaiting review"
              icon="shieldCheck"
              alert={m.queues.pendingVerifications > 0}
            />
            <StatCard
              label="Open reports"
              value={m.queues.openReports}
              href="/dashboard/moderation"
              hint="Unresolved"
              icon="flag"
              alert={m.queues.openReports > 0}
            />
            <StatCard
              label="Payouts to process"
              value={m.queues.pendingPayouts}
              href="/dashboard/payouts"
              hint={
                m.revenue.payoutBacklogMinor > 0
                  ? `${inr(m.revenue.payoutBacklogMinor)} owed`
                  : 'Nothing pending'
              }
              icon="wallet"
              alert={m.queues.pendingPayouts > 0}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={`Signups · ${windowText}`} icon="users">
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{m.signups.total}</p>
                <Trend current={m.signups.total} previous={m.signups.prevTotal} />
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {m.signups.aspirant} students · {m.signups.mentor} mentors
              </p>
              {m.signups.series.length > 1 && (
                <>
                  <div className="mt-3">
                    <MiniBarChart
                      data={m.signups.series}
                      keys={['aspirant', 'mentor']}
                      colors={['#d4d4d8', '#6366f1']}
                    />
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-zinc-300 dark:bg-zinc-700" /> Students
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-indigo-500" /> Mentors
                    </span>
                  </div>
                </>
              )}
            </Panel>

            <Panel title={`Sessions · ${windowText}`} icon="message">
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{m.sessions.total}</p>
                <Trend current={m.sessions.total} previous={m.sessions.prevTotal} />
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {m.sessions.chat} chats · {m.sessions.call} calls
              </p>
              {m.sessions.series.length > 1 && (
                <>
                  <div className="mt-3">
                    <MiniBarChart
                      data={m.sessions.series}
                      keys={['chat', 'call']}
                      colors={['#5eead4', '#a78bfa']}
                    />
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-teal-300" /> Chat
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-violet-400" /> Call
                    </span>
                  </div>
                </>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title={`Active users · ${windowText}`} icon="activity">
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {m.activeUsers.current}
                </p>
                <Trend current={m.activeUsers.current} previous={m.activeUsers.previous} />
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Counted from each user&apos;s most recent activity, so older ranges read a little low.
              </p>
            </Panel>

            <div className="lg:col-span-2">
              <Panel title={`Money · ${windowText}`} icon="wallet">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">
                  <Stat
                    label="Top-ups collected"
                    value={inr(m.revenue.topupMinor)}
                    sub={prev && <Trend current={m.revenue.topupMinor} previous={prev.topupMinor} />}
                  />
                  <Stat
                    label="Mentor earnings"
                    value={inr(m.revenue.mentorEarningsMinor)}
                    sub={
                      prev && (
                        <Trend
                          current={m.revenue.mentorEarningsMinor}
                          previous={prev.mentorEarningsMinor}
                        />
                      )
                    }
                  />
                  <Stat
                    label="Payouts paid"
                    value={inr(m.revenue.payoutsPaidMinor)}
                    sub={
                      prev && (
                        <Trend current={m.revenue.payoutsPaidMinor} previous={prev.payoutsPaidMinor} />
                      )
                    }
                  />
                  <Stat
                    label="Refunds"
                    value={inr(m.revenue.refundsMinor)}
                    sub={
                      prev && (
                        <Trend
                          current={m.revenue.refundsMinor}
                          previous={prev.refundsMinor}
                          lowerIsBetter
                        />
                      )
                    }
                  />
                  <Stat
                    label="Payout backlog"
                    value={inr(m.revenue.payoutBacklogMinor)}
                    sub={
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">owed right now</span>
                    }
                  />
                </div>
              </Panel>
            </div>
          </div>

          <Panel title="All time" icon="gauge">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Stat label="Total users" value={m.totals.users} />
              <Stat
                label="Mentors"
                value={
                  <>
                    {m.totals.verifiedMentors}
                    <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">
                      {' '}
                      / {m.totals.mentors} verified
                    </span>
                  </>
                }
              />
              <Stat label="Universities" value={m.totals.universities} />
            </div>
          </Panel>
        </div>
      )}
    </DashboardShell>
  );
}
