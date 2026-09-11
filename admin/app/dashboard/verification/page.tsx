import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { FilterTabs, Table } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import { VerificationRow, type VerificationRequestRow } from './VerificationRow';
import { HistoryList } from './HistoryList';
import type { VerificationHistoryRowData } from './actions';

const VIEW_TABS = ['queue', 'history'] as const;
const STATUS_TABS = ['ALL', 'VERIFIED', 'REJECTED'] as const;

export default async function VerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; search?: string }>;
}) {
  const { view: rawView, status: rawStatus, search } = await searchParams;
  const view = VIEW_TABS.includes(rawView as (typeof VIEW_TABS)[number])
    ? (rawView as (typeof VIEW_TABS)[number])
    : 'queue';
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? rawStatus!
    : 'ALL';

  const historyParams = new URLSearchParams({ limit: '30' });
  if (status !== 'ALL') historyParams.set('status', status);
  if (search) historyParams.set('search', search);

  const [email, queue, historyPage] = await Promise.all([
    getAdminEmail(),
    view === 'queue'
      ? backendFetch<VerificationRequestRow[]>('/verification/queue').catch(() => [])
      : Promise.resolve([] as VerificationRequestRow[]),
    view === 'history'
      ? backendFetch<{ data: VerificationHistoryRowData[]; nextCursor: string | null }>(
          `/verification/history?${historyParams.toString()}`,
        ).catch(() => ({ data: [], nextCursor: null }))
      : Promise.resolve({ data: [], nextCursor: null }),
  ]);

  return (
    <DashboardShell title="Verification" email={email}>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <FilterTabs
          items={VIEW_TABS}
          current={view}
          hrefFor={(v) => (v === 'queue' ? '/dashboard/verification' : '/dashboard/verification?view=history')}
          labelFor={(v) => (v === 'queue' ? 'Pending queue' : 'History')}
        />
        {view === 'history' && (
          <FilterTabs
            size="sm"
            items={STATUS_TABS}
            current={status as (typeof STATUS_TABS)[number]}
            hrefFor={(s) => {
              const p = new URLSearchParams({ view: 'history' });
              if (s !== 'ALL') p.set('status', s);
              if (search) p.set('search', search);
              return `/dashboard/verification?${p.toString()}`;
            }}
            labelFor={(s) => (s === 'ALL' ? 'Any decision' : s)}
          />
        )}
      </div>

      {view === 'history' && (
        <form className="mb-4 flex gap-2" action="/dashboard/verification">
          <input type="hidden" name="view" value="history" />
          {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by applicant name…"
            className="w-72 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/40"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
          >
            Search
          </button>
        </form>
      )}

      {view === 'queue' ? (
        queue.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No pending verification requests. New submissions show up here in
            FIFO order.
          </p>
        ) : (
          <Table
            head={
              <tr>
                <Table.HeadCell>Applicant</Table.HeadCell>
                <Table.HeadCell>Role</Table.HeadCell>
                <Table.HeadCell>College · document</Table.HeadCell>
                <Table.HeadCell>Submitted</Table.HeadCell>
                <Table.HeadCell className="w-8" />
              </tr>
            }
          >
            {queue.map((request) => (
              <VerificationRow key={request.id} request={request} />
            ))}
          </Table>
        )
      ) : (
        <HistoryList
          key={`${status}|${search ?? ''}`}
          initialItems={historyPage.data}
          initialCursor={historyPage.nextCursor}
          filters={{ status, search }}
        />
      )}
    </DashboardShell>
  );
}
