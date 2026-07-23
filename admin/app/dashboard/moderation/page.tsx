import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { ReportRow } from './ReportRow';

interface ReportRowData {
  id: string;
  reporterId: string;
  reporterDisplayName?: string;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
}

const STATUS_TABS = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const;

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? rawStatus
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

      {page.data.length === 0 ? (
        <p className="text-sm text-zinc-500">No reports in this status.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {page.data.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              readOnly={status === 'RESOLVED' || status === 'DISMISSED'}
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
