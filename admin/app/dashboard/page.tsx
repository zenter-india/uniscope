import Link from 'next/link';
import { backendFetch } from '../../lib/backend';
import { getAdminEmail } from '../../lib/adminAuth';
import { DashboardShell } from './DashboardShell';

export default async function DashboardPage() {
  const [email, queue, openReports, leadStats] = await Promise.all([
    getAdminEmail(),
    backendFetch<unknown[]>('/verification/queue').catch(() => []),
    backendFetch<{ data: unknown[] }>('/reports?status=OPEN&limit=50')
      .then((r) => r.data)
      .catch(() => []),
    backendFetch<{ byStatus: Record<string, number> }>('/enrollments/stats').catch(() => null),
  ]);

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
  ];

  return (
    <DashboardShell title="Overview" email={email}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm"
          >
            <p className="text-sm font-medium text-zinc-700">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-zinc-900">{card.value}</p>
            <p className="mt-1 text-xs text-zinc-400">View queue →</p>
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
