import Link from 'next/link';
import { backendFetch } from '../../lib/backend';
import { getAdminEmail } from '../../lib/adminAuth';
import { Card, FilterTabs } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { DashboardShell } from './DashboardShell';
import { MiniBarChart } from './MiniBarChart';

interface DashboardMetrics {
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

const RANGES = [7, 30, 90] as const;

function inr(minor: number): string {
  return (minor / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}

function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return <span className="text-xs text-zinc-400">{current > 0 ? 'new' : 'no prior data'}</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span className="text-xs text-zinc-400">flat vs prev</span>;
  const up = pct > 0;
  const TrendIcon = up ? Icon.trendUp : Icon.trendDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ${
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
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
      className="group rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition hover:border-zinc-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-600">{label}</p>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            alert ? 'bg-amber-50 text-amber-600' : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          <IconCmp className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
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
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
        {IconCmp && <IconCmp className="h-4 w-4 text-zinc-400" />}
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">{value}</p>
      {sub}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: rawDays } = await searchParams;
  const days = RANGES.includes(Number(rawDays) as (typeof RANGES)[number])
    ? Number(rawDays)
    : 30;

  const [email, m] = await Promise.all([
    getAdminEmail(),
    backendFetch<DashboardMetrics>(`/admin/metrics?days=${days}`).catch(() => null),
  ]);

  return (
    <DashboardShell title="Overview" email={email}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Range</span>
        <FilterTabs
          items={RANGES}
          current={days as (typeof RANGES)[number]}
          hrefFor={(r) => `/dashboard?days=${r}`}
          labelFor={(r) => `${r}d`}
        />
      </div>

      {!m ? (
        <p className="text-sm text-zinc-500">
          Metrics are unavailable right now — the backend didn&apos;t respond.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Panel title={`Signups · last ${days} days`} icon="users">
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-semibold tracking-tight text-zinc-900">{m.signups.total}</p>
                <Trend current={m.signups.total} previous={m.signups.prevTotal} />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {m.signups.aspirant} students · {m.signups.mentor} mentors
              </p>
              <div className="mt-3">
                <MiniBarChart
                  data={m.signups.series}
                  keys={['aspirant', 'mentor']}
                  colors={['#d4d4d8', '#6366f1']}
                />
              </div>
              <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-zinc-300" /> Students
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-indigo-500" /> Mentors
                </span>
              </div>
            </Panel>

            <Panel title={`Sessions · last ${days} days`} icon="message">
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-semibold tracking-tight text-zinc-900">{m.sessions.total}</p>
                <Trend current={m.sessions.total} previous={m.sessions.prevTotal} />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {m.sessions.chat} chats · {m.sessions.call} calls
              </p>
              <div className="mt-3">
                <MiniBarChart
                  data={m.sessions.series}
                  keys={['chat', 'call']}
                  colors={['#5eead4', '#a78bfa']}
                />
              </div>
              <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-teal-300" /> Chat
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-violet-400" /> Call
                </span>
              </div>
            </Panel>
          </div>

          <Panel title={`Money · last ${days} days`} icon="wallet">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Top-ups collected" value={inr(m.revenue.topupMinor)} />
              <Stat label="Mentor earnings" value={inr(m.revenue.mentorEarningsMinor)} />
              <Stat label="Payouts paid" value={inr(m.revenue.payoutsPaidMinor)} />
              <Stat label="Payout backlog" value={inr(m.revenue.payoutBacklogMinor)} />
              <Stat label="Refunds" value={inr(m.revenue.refundsMinor)} />
            </div>
          </Panel>

          <Panel title="All time" icon="gauge">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <Stat
                label={`Active users (${days}d)`}
                value={m.activeUsers.current}
                sub={<Trend current={m.activeUsers.current} previous={m.activeUsers.previous} />}
              />
              <Stat label="Total users" value={m.totals.users} />
              <Stat
                label="Mentors"
                value={
                  <>
                    {m.totals.verifiedMentors}
                    <span className="text-sm font-normal text-zinc-400">
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
