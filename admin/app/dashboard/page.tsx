import Link from 'next/link';
import { backendFetch } from '../../lib/backend';
import { getAdminEmail } from '../../lib/adminAuth';
import { DashboardShell } from './DashboardShell';

export default async function DashboardPage() {
  const [email, queue, openReports, leadStats, pendingPayouts, liveSessions] =
    await Promise.all([
      getAdminEmail(),
      backendFetch<unknown[]>('/verification/queue').catch(() => []),
      backendFetch<{ data: unknown[] }>('/reports?status=OPEN&limit=50')
        .then((r) => r.data)
        .catch(() => []),
      backendFetch<{ byStatus: Record<string, number> }>('/enrollments/stats').catch(() => null),
      backendFetch<{ amountMinor: number }[]>('/payouts?status=PENDING').catch(
        () => [] as { amountMinor: number }[],
      ),
      backendFetch<{ data: unknown[] }>('/sessions/admin/all?status=IN_PROGRESS&limit=50')
        .then((r) => r.data)
        .catch(() => []),
    ]);

  const payoutTotalMinor = pendingPayouts.reduce((s, p) => s + p.amountMinor, 0);

  const statCards = [
    {
      label: 'New leads',
      value: leadStats?.byStatus.NEW ?? 0,
      href: '/dashboard/leads?status=NEW',
    },
    {
      label: 'Pending verifications',
      value: queue.length,
      href: '/dashboard/verification',
    },
    {
      label: 'Open reports',
      value: openReports.length,
      href: '/dashboard/moderation',
    },
    {
      label: 'Sessions in progress',
      value: liveSessions.length,
      href: '/dashboard/sessions?status=IN_PROGRESS',
      hint: 'View sessions →',
    },
    {
      label: 'Payouts to process',
      value: pendingPayouts.length,
      href: '/dashboard/payouts',
      hint:
        payoutTotalMinor > 0
          ? `${(payoutTotalMinor / 100).toLocaleString('en-IN', {
              style: 'currency',
              currency: 'INR',
            })} owed`
          : undefined,
    },
  ];

  return (
    <DashboardShell title="Overview" email={email}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm"
          >
            <p className="text-sm font-medium text-zinc-700">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-zinc-900">{card.value}</p>
            <p className="mt-1 text-xs text-zinc-400">{card.hint ?? 'View queue →'}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {[
          { label: 'Users', href: '/dashboard/users' },
          { label: 'Universities', href: '/dashboard/universities' },
          { label: 'Enrollment leads', href: '/dashboard/leads' },
          { label: 'Data import', href: '/dashboard/data-import' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {link.label} →
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}
