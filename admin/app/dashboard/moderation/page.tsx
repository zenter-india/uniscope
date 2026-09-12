import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { FilterTabs } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import type { ReportRowData } from './ReportRow';
import { ReportsList } from './ReportsList';

const STATUS_TABS = ['ALL', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const;

function buildHref(p: {
  status: string;
  reporterId?: string;
  targetUserId?: string;
  userName?: string;
}) {
  const qs = new URLSearchParams({ status: p.status });
  if (p.reporterId) qs.set('reporterId', p.reporterId);
  if (p.targetUserId) qs.set('targetUserId', p.targetUserId);
  if (p.userName) qs.set('userName', p.userName);
  return `/dashboard/moderation?${qs.toString()}`;
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    reporterId?: string;
    targetUserId?: string;
    userName?: string;
  }>;
}) {
  const { status: rawStatus, reporterId, targetUserId, userName } = await searchParams;
  const filteredToUser = Boolean(reporterId || targetUserId);
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? rawStatus!
    : filteredToUser
      ? 'ALL'
      : 'OPEN';

  const params = new URLSearchParams({ limit: '50' });
  if (status !== 'ALL') params.set('status', status);
  if (reporterId) params.set('reporterId', reporterId);
  if (targetUserId) params.set('targetUserId', targetUserId);

  const [email, page] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: ReportRowData[]; nextCursor: string | null }>(
      `/reports?${params.toString()}`,
    ).catch(() => ({ data: [], nextCursor: null })),
  ]);

  return (
    <DashboardShell title="Moderation" email={email}>
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        User-submitted reports on other users, sessions, or reviews. Resolve with an
        optional manual refund, or dismiss if there&apos;s nothing to act on.
      </p>
      {filteredToUser && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 px-3 py-2 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            Filtered to reports {reporterId ? 'filed by' : 'against'}{' '}
            <Link
              href={`/dashboard/users/${reporterId ?? targetUserId}`}
              className="font-medium text-zinc-900 dark:text-zinc-100 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
            >
              {userName ?? reporterId ?? targetUserId}
            </Link>
          </span>
          <Link
            href="/dashboard/moderation"
            className="text-xs text-zinc-500 dark:text-zinc-400 underline hover:text-zinc-800 dark:hover:text-zinc-100"
          >
            Clear
          </Link>
        </div>
      )}
      <div className="mb-4">
        <FilterTabs
          items={STATUS_TABS}
          current={status as (typeof STATUS_TABS)[number]}
          hrefFor={(tab) => buildHref({ status: tab, reporterId, targetUserId, userName })}
          labelFor={(tab) => (tab === 'ALL' ? 'Any status' : tab.replace('_', ' '))}
        />
      </div>

      <ReportsList
        key={`${status}|${reporterId ?? ''}|${targetUserId ?? ''}`}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ status, reporterId, targetUserId }}
      />
    </DashboardShell>
  );
}
