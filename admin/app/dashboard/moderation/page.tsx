import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import type { ReportRowData } from './ReportRow';
import { ReportsList } from './ReportsList';

const STATUS_TABS = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const;

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? rawStatus!
    : 'OPEN';

  const [email, page] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: ReportRowData[]; nextCursor: string | null }>(
      `/reports?status=${status}&limit=50`,
    ).catch(() => ({ data: [], nextCursor: null })),
  ]);

  return (
    <DashboardShell title="Moderation" email={email}>
      <div className="mb-4 flex gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/moderation?status=${tab}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              status === tab
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab.replace('_', ' ')}
          </Link>
        ))}
      </div>

      <ReportsList
        key={status}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        status={status}
        readOnly={status === 'RESOLVED' || status === 'DISMISSED'}
      />
    </DashboardShell>
  );
}
