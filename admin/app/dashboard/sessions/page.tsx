import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
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

function buildHref(params: { status?: string; type?: string; search?: string }) {
  const qs = new URLSearchParams();
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params.type && params.type !== 'ALL') qs.set('type', params.type);
  if (params.search) qs.set('search', params.search);
  const s = qs.toString();
  return `/dashboard/sessions${s ? `?${s}` : ''}`;
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; search?: string }>;
}) {
  const { status: rawStatus, type: rawType, search } = await searchParams;
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? rawStatus!
    : 'ALL';
  const type = TYPE_TABS.includes(rawType as (typeof TYPE_TABS)[number]) ? rawType! : 'ALL';

  const params = new URLSearchParams({ limit: '25' });
  if (status !== 'ALL') params.set('status', status);
  if (type !== 'ALL') params.set('type', type);
  if (search) params.set('search', search);

  const [email, page] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: SessionRowData[]; nextCursor: string | null }>(
      `/sessions/admin/all?${params.toString()}`,
    ).catch(() => ({ data: [] as SessionRowData[], nextCursor: null })),
  ]);

  return (
    <DashboardShell title="Sessions" email={email}>
      <form className="mb-4 flex gap-2" action="/dashboard/sessions">
        {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
        {type !== 'ALL' && <input type="hidden" name="type" value={type} />}
        <input
          type="text"
          name="search"
          defaultValue={search ?? ''}
          placeholder="Search by aspirant or mentor name…"
          className="w-80 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Search
        </button>
      </form>

      <div className="mb-2 flex flex-wrap gap-2">
        {TYPE_TABS.map((tab) => (
          <Link
            key={tab}
            href={buildHref({ status, type: tab, search })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              type === tab
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab === 'ALL' ? 'All types' : tab === 'CHAT' ? 'Chat' : 'Call'}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab}
            href={buildHref({ status: tab, type, search })}
            className={`rounded-lg px-3 py-1 text-xs font-medium ${
              status === tab
                ? 'bg-zinc-700 text-white'
                : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-100'
            }`}
          >
            {tab === 'ALL' ? 'Any status' : tab.replace('_', ' ')}
          </Link>
        ))}
      </div>

      <SessionsList
        key={`${status}|${type}|${search ?? ''}`}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ status, type, search }}
      />
    </DashboardShell>
  );
}
