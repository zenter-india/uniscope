import Link from 'next/link';
import type { ReactNode } from 'react';
import { getAdminEmail } from '../../../lib/adminAuth';
import { Badge, Card, EmptyState } from '../../../components/ui';
import { Icon, type IconName } from '../../../components/icons';
import { DashboardShell } from '../DashboardShell';
import { getRailwayUsage, getSupabaseUsage } from '../integrations/actions';
import { getSystemHealth } from './actions';

export const dynamic = 'force-dynamic';

function AppIcon({ name, className }: { name: IconName; className?: string }) {
  const Cmp = Icon[name];
  return <Cmp className={className} />;
}

const SENTRY_PAYMENTS_URL =
  'https://amsel-gold.sentry.io/issues/?query=flow%3Apayments&statsPeriod=7d';
const SENTRY_ALL_URL = 'https://amsel-gold.sentry.io/issues/?statsPeriod=24h';
const RAILWAY_URL = 'https://railway.com/project/d72e0639-a95c-4017-8276-9c7adeecd0f1';

function uniminutes(minor: number): string {
  return `${Math.round(minor / 1000).toLocaleString('en-IN')} Uniminutes`;
}

function ago(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function uptime(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} days`;
}

function Stat({ label, value, hint, tone }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'warning' | 'danger';
}) {
  const valueTone =
    tone === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-zinc-900 dark:text-zinc-100';
  return (
    <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 text-base font-semibold ${valueTone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

function Section({ title, icon, description, action, children }: {
  title: string;
  icon: IconName;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <AppIcon name={icon} className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {children}
      <AppIcon name="external" className="h-3.5 w-3.5" />
    </a>
  );
}

function InternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {children}
      <AppIcon name="chevronRight" className="h-3.5 w-3.5" />
    </Link>
  );
}

export default async function HealthPage() {
  const [email, health, railway, supabase] = await Promise.all([
    getAdminEmail(),
    getSystemHealth(),
    getRailwayUsage(),
    getSupabaseUsage(),
  ]);

  if (!health.ok) {
    return (
      <DashboardShell title="Health" email={email}>
        <EmptyState icon="alert">
          Could not load health data — the backend did not answer ({health.error}). That itself
          means something is wrong: check Railway.
        </EmptyState>
      </DashboardShell>
    );
  }

  const h = health.data;
  const backendService = railway.services?.find((s) => s.name === 'uniscope');
  const deployStatus = backendService?.latestDeploymentStatus ?? null;
  const deployFailed = deployStatus != null && ['FAILED', 'CRASHED'].includes(deployStatus.toUpperCase());

  const warnings = [...h.warnings];
  if (deployFailed) warnings.unshift(`The latest backend deploy is ${deployStatus} — production is still on the previous build.`);
  if (
    supabase.databaseSizeBytes != null &&
    supabase.databaseSizeLimitBytes != null &&
    supabase.databaseSizeBytes > supabase.databaseSizeLimitBytes * 0.8
  ) {
    warnings.push('The database is over 80% of the Supabase free-plan limit (it goes read-only at 100%).');
  }

  const dbSizePct =
    supabase.databaseSizeBytes != null && supabase.databaseSizeLimitBytes
      ? Math.round((supabase.databaseSizeBytes / supabase.databaseSizeLimitBytes) * 100)
      : null;

  return (
    <DashboardShell title="Health" email={email}>
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        How the business is running over the last {h.windowHours} hours, straight from the
        database. Errors and crashes live in Sentry (links below). Updated{' '}
        {new Date(h.generatedAt).toLocaleTimeString()} — reload the page to refresh.
      </p>

      {warnings.length === 0 ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <AppIcon name="check" className="h-4 w-4 shrink-0" />
          All clear — nothing needs attention right now.
        </div>
      ) : (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
          <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <AppIcon name="alert" className="h-4 w-4 shrink-0" />
            {warnings.length === 1 ? '1 thing needs a look' : `${warnings.length} things need a look`}
          </p>
          <ul className="ml-6 list-disc space-y-0.5 text-sm text-amber-800 dark:text-amber-300">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Section
          title="Payments"
          icon="wallet"
          description="Wallet top-ups credited (Apple + Razorpay). Failed purchases never reach the database — they are in Sentry."
          action={<ExternalLink href={SENTRY_PAYMENTS_URL}>Payment errors in Sentry</ExternalLink>}
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            <Stat label="Top-ups (24h)" value={h.payments.topupsCount} hint={uniminutes(h.payments.topupsCreditedMinor)} />
            <Stat label="Apple credited (24h)" value={h.payments.appleCredited} />
            <Stat label="Last top-up" value={ago(h.payments.lastTopupAt)} />
            <Stat
              label="Refunded before credit (24h)"
              value={h.payments.appleRefundedBeforeCredit}
              tone={h.payments.appleRefundedBeforeCredit > 0 ? 'warning' : undefined}
            />
            <Stat
              label="Refunds to fix by hand"
              value={h.payments.refundsNeedingManualFix}
              tone={h.payments.refundsNeedingManualFix > 0 ? 'danger' : undefined}
              hint="User already spent the Uniminutes"
            />
          </div>
        </Section>

        <Section
          title="Calls"
          icon="clock"
          description="Audio calls that ended in the last 24 hours, and what is waiting right now."
          action={<InternalLink href="/dashboard/sessions">Sessions</InternalLink>}
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            <Stat
              label="Connect rate"
              value={h.calls.connectRatePercent == null ? '—' : `${h.calls.connectRatePercent}%`}
              tone={h.calls.connectRatePercent != null && h.calls.connectRatePercent < 50 ? 'warning' : undefined}
              hint="Connected ÷ all calls that ended"
            />
            <Stat label="Connected" value={h.calls.connected} />
            <Stat label="Never connected" value={h.calls.endedBeforeConnect} hint="Someone hung up first" />
            <Stat label="No-shows" value={h.calls.noShows} />
            <Stat label="Requested (24h)" value={h.calls.requested} />
            <Stat label="Live now" value={h.calls.liveNow} hint={`${h.calls.pendingNow} waiting for a mentor`} />
          </div>
        </Section>

        <Section title="People" icon="users" description="Sign-ups and activity in the last 24 hours." action={<InternalLink href="/dashboard/users">Users</InternalLink>}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="New sign-ups" value={h.users.signups} />
            <Stat label="Active users" value={h.users.activeUsers} />
          </div>
        </Section>

        <Section title="Work queues" icon="flag" description="Things an admin needs to act on.">
          <div className="grid grid-cols-2 gap-3">
            <Link href="/dashboard/verification">
              <Stat label="Verifications" value={h.queues.verificationsPending} hint={h.queues.oldestVerificationAt ? `Oldest ${ago(h.queues.oldestVerificationAt)}` : 'None waiting'} />
            </Link>
            <Link href="/dashboard/payouts">
              <Stat label="Payouts" value={h.queues.payoutsPending} hint={h.queues.oldestPayoutAt ? `Oldest ${ago(h.queues.oldestPayoutAt)}` : 'None waiting'} />
            </Link>
            <Link href="/dashboard/moderation">
              <Stat label="Open reports" value={h.queues.reportsOpen} />
            </Link>
            <Link href="/dashboard/support">
              <Stat label="Technical reports" value={h.queues.technicalReportsOpen} />
            </Link>
          </div>
        </Section>

        <Section
          title="Infrastructure"
          icon="activity"
          description="Server, database and the latest deploy."
          action={
            <div className="flex gap-3">
              <ExternalLink href={SENTRY_ALL_URL}>Sentry</ExternalLink>
              <ExternalLink href={RAILWAY_URL}>Railway</ExternalLink>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            <Stat
              label="Database"
              value={h.database.ok ? 'Up' : 'Down'}
              tone={h.database.ok ? undefined : 'danger'}
              hint={h.database.latencyMs != null ? `${h.database.latencyMs} ms` : undefined}
            />
            <Stat label="Server uptime" value={uptime(h.server.uptimeSeconds)} hint="Since last restart/deploy" />
            <Stat
              label="Latest deploy"
              value={deployStatus ? <Badge tone={deployFailed ? 'danger' : deployStatus === 'SUCCESS' ? 'success' : 'warning'}>{deployStatus}</Badge> : '—'}
              hint={railway.error ?? (railway.configured ? undefined : 'Railway not configured')}
            />
            <Stat
              label="Database size"
              value={dbSizePct == null ? '—' : `${dbSizePct}%`}
              tone={dbSizePct != null && dbSizePct > 80 ? 'warning' : undefined}
              hint="of the 500 MB free plan"
            />
          </div>
        </Section>
      </div>
    </DashboardShell>
  );
}
