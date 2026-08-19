import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { LeadRow, type LeadRowData } from './LeadRow';

const ROLE_TABS = ['ALL', 'ASPIRANT', 'MENTOR'] as const;
const STATUS_TABS = ['ALL', 'NEW', 'CONTACTED', 'CONVERTED', 'REJECTED'] as const;

interface LeadStats {
  total: number;
  byStatus: Record<string, number>;
  byRole: Record<string, number>;
}

function buildHref(role: string, status: string, search?: string) {
  const params = new URLSearchParams();
  if (role !== 'ALL') params.set('role', role);
  if (status !== 'ALL') params.set('status', status);
  if (search) params.set('search', search);
  const qs = params.toString();
  return `/dashboard/leads${qs ? `?${qs}` : ''}`;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; status?: string; search?: string }>;
}) {
  const { role: rawRole, status: rawStatus, search } = await searchParams;
  const role = ROLE_TABS.includes(rawRole as (typeof ROLE_TABS)[number]) ? rawRole! : 'ALL';
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? rawStatus!
    : 'ALL';

  const params = new URLSearchParams({ limit: '100' });
  if (role !== 'ALL') params.set('role', role);
  if (status !== 'ALL') params.set('status', status);
  if (search) params.set('search', search);

  const [email, page, stats] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: LeadRowData[]; nextCursor: string | null }>(
      `/enrollments?${params.toString()}`,
    ).catch(() => ({ data: [], nextCursor: null })),
    backendFetch<LeadStats>('/enrollments/stats').catch(() => null),
  ]);

  return (
    <DashboardShell title="Enrollment Leads" email={email}>
      {stats && (
        <div className="mb-5 flex flex-wrap gap-3">
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <p className="text-xs text-zinc-400">Total</p>
            <p className="text-lg font-semibold text-zinc-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <p className="text-xs text-zinc-400">Students</p>
            <p className="text-lg font-semibold text-zinc-900">{stats.byRole.ASPIRANT ?? 0}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <p className="text-xs text-zinc-400">Mentors</p>
            <p className="text-lg font-semibold text-zinc-900">{stats.byRole.MENTOR ?? 0}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <p className="text-xs text-zinc-400">New</p>
            <p className="text-lg font-semibold text-zinc-900">{stats.byStatus.NEW ?? 0}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <p className="text-xs text-zinc-400">Converted</p>
            <p className="text-lg font-semibold text-zinc-900">{stats.byStatus.CONVERTED ?? 0}</p>
          </div>
          <a
            href={`/dashboard/leads/export${params.toString() ? `?${params.toString()}` : ''}`}
            className="ml-auto self-center rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Export CSV
          </a>
        </div>
      )}

      <form className="mb-4 flex gap-2" action="/dashboard/leads">
        {role !== 'ALL' && <input type="hidden" name="role" value={role} />}
        {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
        <input
          type="text"
          name="search"
          defaultValue={search ?? ''}
          placeholder="Search by name, phone, email, college..."
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
        {ROLE_TABS.map((tab) => (
          <Link
            key={tab}
            href={buildHref(tab, status, search)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              role === tab
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab === 'ALL' ? 'All roles' : tab === 'ASPIRANT' ? 'Students' : 'Mentors'}
          </Link>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab}
            href={buildHref(role, tab, search)}
            className={`rounded-lg px-3 py-1 text-xs font-medium ${
              status === tab
                ? 'bg-zinc-700 text-white'
                : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-100'
            }`}
          >
            {tab}
          </Link>
        ))}
      </div>

      {page.data.length === 0 ? (
        <p className="text-sm text-zinc-500">No leads match this filter.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {page.data.map((lead) => (
            <LeadRow key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
