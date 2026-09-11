import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { FilterTabs } from '../../../components/ui';
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
      <p className="mb-5 text-sm text-zinc-500">
        User-submitted reports on other users, sessions, or reviews. Resolve with an
        optional manual refund, or dismiss if there&apos;s nothing to act on.
      </p>
      <div className="mb-4">
        <FilterTabs
          items={STATUS_TABS}
          current={status as (typeof STATUS_TABS)[number]}
          hrefFor={(tab) => `/dashboard/moderation?status=${tab}`}
          labelFor={(tab) => tab.replace('_', ' ')}
        />
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
