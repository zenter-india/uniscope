import Link from 'next/link';
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
  userId?: string;
  userName?: string;
}) {
  const qs = new URLSearchParams();
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params.type && params.type !== 'ALL') qs.set('type', params.type);
  if (params.search) qs.set('search', params.search);
  if (params.sort) qs.set('sort', params.sort);
  if (params.dir) qs.set('dir', params.dir);
  if (params.userId) qs.set('userId', params.userId);
  if (params.userName) qs.set('userName', params.userName);
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
    userId?: string;
    userName?: string;
  }>;
}) {
  const {
    status: rawStatus,
    type: rawType,
    search,
    sort: rawSort,
    dir: rawDir,
    userId,
    userName,
  } = await searchParams;
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
  if (userId) params.set('userId', userId);
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
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        Every chat and call between a student and mentor. Expand a row to see the full
        detail, read the chat transcript, or force-end a stuck session.
      </p>
      {userId && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 px-3 py-2 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            Filtered to sessions involving{' '}
            <Link
              href={`/dashboard/users/${userId}`}
              className="font-medium text-zinc-900 dark:text-zinc-100 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
            >
              {userName ?? userId}
            </Link>
          </span>
          <Link
            href={buildHref({ status, type, search, sort, dir })}
            className="text-xs text-zinc-500 dark:text-zinc-400 underline hover:text-zinc-800 dark:hover:text-zinc-100"
          >
            Clear
          </Link>
        </div>
      )}
      <div className="mb-5 flex flex-col gap-3">
        <form className="flex gap-2" action="/dashboard/sessions">
          {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
          {type !== 'ALL' && <input type="hidden" name="type" value={type} />}
          {userId && <input type="hidden" name="userId" value={userId} />}
          {userName && <input type="hidden" name="userName" value={userName} />}
          <input
            type="text"
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by aspirant or mentor name…"
            className="w-80 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-2 focus:ring-zinc-400/40 dark:focus:ring-zinc-600/40"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterTabs
            items={TYPE_TABS}
            current={type as (typeof TYPE_TABS)[number]}
            hrefFor={(tab) => buildHref({ status, type: tab, search, sort, dir, userId, userName })}
            labelFor={(tab) => (tab === 'ALL' ? 'All types' : tab === 'CHAT' ? 'Chat' : 'Call')}
          />
          <FilterTabs
            size="sm"
            items={STATUS_TABS}
            current={status as (typeof STATUS_TABS)[number]}
            hrefFor={(tab) => buildHref({ status: tab, type, search, sort, dir, userId, userName })}
            labelFor={(tab) => (tab === 'ALL' ? 'Any status' : tab.replace('_', ' '))}
          />
        </div>
      </div>

      <SessionsList
        key={`${status}|${type}|${search ?? ''}|${sort ?? ''}|${dir ?? ''}|${userId ?? ''}`}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ status, type, search, sort, dir, userId }}
      />
    </DashboardShell>
  );
}
