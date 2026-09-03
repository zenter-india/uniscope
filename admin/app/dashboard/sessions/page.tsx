import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { FilterTabs } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import { SessionsList } from './SessionsList';
import type { SessionRowData } from './actions';

const STATUS_TABS = [
  'ALL',
  'PENDING',
  'ACCEPTED',
  'RINGING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
  'FAILED',
] as const;
const TYPE_TABS = ['ALL', 'CHAT', 'AUDIO_CALL'] as const;

const SORT_KEYS = ['requested', 'cost', 'status'];

function buildHref(params: {
  status?: string;
  type?: string;
  search?: string;
  sort?: string;
  dir?: string;
}) {
  const qs = new URLSearchParams();
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params.type && params.type !== 'ALL') qs.set('type', params.type);
  if (params.search) qs.set('search', params.search);
  if (params.sort) qs.set('sort', params.sort);
  if (params.dir) qs.set('dir', params.dir);
  const s = qs.toString();
  return `/dashboard/sessions${s ? `?${s}` : ''}`;
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    search?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { status: rawStatus, type: rawType, search, sort: rawSort, dir: rawDir } =
    await searchParams;
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? rawStatus!
    : 'ALL';
  const type = TYPE_TABS.includes(rawType as (typeof TYPE_TABS)[number]) ? rawType! : 'ALL';
  const sort = rawSort && SORT_KEYS.includes(rawSort) ? rawSort : undefined;
  const dir = rawDir === 'asc' ? 'asc' : sort ? 'desc' : undefined;

  const params = new URLSearchParams({ limit: '25' });
  if (status !== 'ALL') params.set('status', status);
  if (type !== 'ALL') params.set('type', type);
  if (search) params.set('search', search);
  if (sort) params.set('sortBy', sort);
  if (dir) params.set('sortDir', dir);

  const [email, page] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: SessionRowData[]; nextCursor: string | null }>(
      `/sessions/admin/all?${params.toString()}`,
    ).catch(() => ({ data: [] as SessionRowData[], nextCursor: null })),
  ]);

  return (
    <DashboardShell title="Sessions" email={email}>
      <div className="mb-5 flex flex-col gap-3">
        <form className="flex gap-2" action="/dashboard/sessions">
          {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
          {type !== 'ALL' && <input type="hidden" name="type" value={type} />}
          <input
            type="text"
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by aspirant or mentor name…"
            className="w-80 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/40"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterTabs
            items={TYPE_TABS}
            current={type as (typeof TYPE_TABS)[number]}
            hrefFor={(tab) => buildHref({ status, type: tab, search, sort, dir })}
            labelFor={(tab) => (tab === 'ALL' ? 'All types' : tab === 'CHAT' ? 'Chat' : 'Call')}
          />
          <FilterTabs
            size="sm"
            items={STATUS_TABS}
            current={status as (typeof STATUS_TABS)[number]}
            hrefFor={(tab) => buildHref({ status: tab, type, search, sort, dir })}
            labelFor={(tab) => (tab === 'ALL' ? 'Any status' : tab.replace('_', ' '))}
          />
        </div>
      </div>

      <SessionsList
        key={`${status}|${type}|${search ?? ''}|${sort ?? ''}|${dir ?? ''}`}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ status, type, search, sort, dir }}
      />
    </DashboardShell>
  );
}
