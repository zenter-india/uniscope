import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { Card, FilterTabs } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import type { LeadRowData } from './LeadRow';
import { LeadsList } from './LeadsList';

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
        <div className="mb-5 flex flex-wrap items-stretch gap-3">
          {[
            ['Total', stats.total],
            ['Students', stats.byRole.ASPIRANT ?? 0],
            ['Mentors', stats.byRole.MENTOR ?? 0],
            ['New', stats.byStatus.NEW ?? 0],
            ['Converted', stats.byStatus.CONVERTED ?? 0],
          ].map(([label, value]) => (
            <Card key={label} className="px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">{value}</p>
            </Card>
          ))}
          <a
            href={`/dashboard/leads/export${params.toString() ? `?${params.toString()}` : ''}`}
            className="ml-auto inline-flex h-9 items-center self-center rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
          >
            Export CSV
          </a>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3">
        <form className="flex gap-2" action="/dashboard/leads">
          {role !== 'ALL' && <input type="hidden" name="role" value={role} />}
          {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by name, phone, email, college…"
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
            items={ROLE_TABS}
            current={role as (typeof ROLE_TABS)[number]}
            hrefFor={(tab) => buildHref(tab, status, search)}
            labelFor={(tab) =>
              tab === 'ALL' ? 'All roles' : tab === 'ASPIRANT' ? 'Students' : 'Mentors'
            }
          />
          <FilterTabs
            size="sm"
            items={STATUS_TABS}
            current={status as (typeof STATUS_TABS)[number]}
            hrefFor={(tab) => buildHref(role, tab, search)}
          />
        </div>
      </div>

      <LeadsList
        key={`${role}|${status}|${search ?? ''}`}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ role, status, search }}
      />
    </DashboardShell>
  );
}
