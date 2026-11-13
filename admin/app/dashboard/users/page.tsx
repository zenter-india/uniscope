import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { FilterTabs } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import type { UserRowData } from './UserRow';
import { UserFilters, type FilterOption } from './UserFilters';
import { UsersList } from './UsersList';

const ROLE_TABS = ['ALL', 'ASPIRANT', 'MENTOR'] as const;
const VERIFICATION_TABS = [
  'ALL',
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
] as const;

const SORT_KEYS = ['joined', 'name', 'role', 'verification'];

/** Everything the page can be filtered by, as it sits in the address. */
interface Current {
  role: string;
  verificationStatus: string;
  banned: boolean;
  restricted: boolean;
  search: string;
  sort?: string;
  dir?: string;
  specialization: string;
  level: '' | 'UG' | 'PG';
  qualification: string;
  stream: string;
  state: string;
  accepting: boolean;
  universityId: string;
  collegeName: string;
}

/** The address for the current view with some parts changed — so changing a
 * tab keeps the search and the filters, and the other way round. */
function hrefFor(current: Current, changes: Partial<Current> = {}) {
  const c = { ...current, ...changes };
  const qs = new URLSearchParams();
  if (c.role && c.role !== 'ALL') qs.set('role', c.role);
  if (c.verificationStatus && c.verificationStatus !== 'ALL')
    qs.set('verificationStatus', c.verificationStatus);
  if (c.banned) qs.set('banned', '1');
  if (c.restricted) qs.set('restricted', '1');
  if (c.search) qs.set('search', c.search);
  if (c.specialization) qs.set('specialization', c.specialization);
  if (c.level) qs.set('level', c.level);
  if (c.qualification) qs.set('qualification', c.qualification);
  if (c.stream) qs.set('stream', c.stream);
  if (c.state) qs.set('state', c.state);
  if (c.accepting) qs.set('accepting', 'true');
  if (c.universityId) {
    qs.set('universityId', c.universityId);
    if (c.collegeName) qs.set('collegeName', c.collegeName);
  }
  if (c.sort) qs.set('sort', c.sort);
  if (c.dir) qs.set('dir', c.dir);
  const s = qs.toString();
  return `/dashboard/users${s ? `?${s}` : ''}`;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string;
    search?: string;
    verificationStatus?: string;
    banned?: string;
    restricted?: string;
    sort?: string;
    dir?: string;
    specialization?: string;
    level?: string;
    qualification?: string;
    stream?: string;
    state?: string;
    accepting?: string;
    universityId?: string;
    collegeName?: string;
  }>;
}) {
  const sp = await searchParams;
  const role = ROLE_TABS.includes(sp.role as (typeof ROLE_TABS)[number]) ? sp.role! : 'ALL';
  const verificationStatus = VERIFICATION_TABS.includes(
    sp.verificationStatus as (typeof VERIFICATION_TABS)[number],
  )
    ? sp.verificationStatus!
    : 'ALL';
  const sort = sp.sort && SORT_KEYS.includes(sp.sort) ? sp.sort : undefined;

  const current: Current = {
    role,
    verificationStatus,
    banned: sp.banned === '1',
    restricted: sp.restricted === '1',
    search: sp.search ?? '',
    sort,
    dir: sp.dir === 'asc' ? 'asc' : sort ? 'desc' : undefined,
    specialization: sp.specialization ?? '',
    level: sp.level === 'UG' || sp.level === 'PG' ? sp.level : '',
    qualification: sp.qualification ?? '',
    stream: sp.stream ?? '',
    state: sp.state ?? '',
    accepting: sp.accepting === 'true',
    universityId: sp.universityId ?? '',
    collegeName: sp.collegeName ?? '',
  };

  const params = new URLSearchParams({ limit: '50' });
  if (role !== 'ALL') params.set('role', role);
  if (current.search) params.set('search', current.search);
  if (verificationStatus !== 'ALL') params.set('verificationStatus', verificationStatus);
  if (current.banned) params.set('isBanned', 'true');
  if (current.restricted) params.set('restricted', 'true');
  if (current.sort) params.set('sortBy', current.sort);
  if (current.dir) params.set('sortDir', current.dir);
  if (current.specialization) params.set('specialization', current.specialization);
  if (current.level) params.set('level', current.level);
  if (current.qualification) params.set('qualification', current.qualification);
  if (current.stream) params.set('stream', current.stream);
  if (current.state) params.set('state', current.state);
  if (current.accepting) params.set('accepting', 'true');
  if (current.universityId) params.set('universityId', current.universityId);

  const noOptions = { specializations: [], qualifications: [], streams: [], states: [] };
  const [email, page, options] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: UserRowData[]; nextCursor: string | null }>(
      `/users?${params.toString()}`,
    ).catch(() => ({ data: [], nextCursor: null })),
    // The dropdowns simply stay at "All …" if this is unavailable.
    backendFetch<{
      specializations: FilterOption[];
      qualifications: FilterOption[];
      streams: FilterOption[];
      states: FilterOption[];
    }>('/users/filter-options').catch(() => noOptions),
  ]);

  // What the tabs and the filter form carry along with them.
  const carried: Record<string, string> = {};
  if (role !== 'ALL') carried.role = role;
  if (verificationStatus !== 'ALL') carried.verificationStatus = verificationStatus;
  if (current.banned) carried.banned = '1';
  if (current.restricted) carried.restricted = '1';
  if (current.sort) carried.sort = current.sort;
  if (current.dir) carried.dir = current.dir;

  const clearHref = hrefFor(current, {
    search: '',
    specialization: '',
    level: '',
    qualification: '',
    stream: '',
    state: '',
    accepting: false,
    universityId: '',
    collegeName: '',
  });

  return (
    <DashboardShell title="Users" email={email}>
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        Every student and mentor account — search, filter, and open a profile to edit,
        ban, or adjust their wallet.
      </p>
      <div className="mb-5 flex flex-col gap-4">
        <UserFilters
          search={current.search}
          specialization={current.specialization}
          level={current.level}
          qualification={current.qualification}
          stream={current.stream}
          state={current.state}
          accepting={current.accepting}
          universityId={current.universityId}
          collegeName={current.collegeName}
          carried={carried}
          options={options}
          clearHref={clearHref}
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterTabs
            items={ROLE_TABS}
            current={role as (typeof ROLE_TABS)[number]}
            hrefFor={(tab) => hrefFor(current, { role: tab })}
          />
          <FilterTabs
            size="sm"
            items={VERIFICATION_TABS}
            current={verificationStatus as (typeof VERIFICATION_TABS)[number]}
            hrefFor={(tab) => hrefFor(current, { verificationStatus: tab })}
            labelFor={(tab) => (tab === 'ALL' ? 'Any verification' : tab.replace('_', ' '))}
          />
          <Link
            href={hrefFor(current, { banned: !current.banned })}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors max-md:py-2 ${
              current.banned
                ? 'bg-red-600 text-white'
                : 'border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {current.banned ? '✓ Banned only' : 'Banned only'}
          </Link>
          <Link
            href={hrefFor(current, { restricted: !current.restricted })}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors max-md:py-2 ${
              current.restricted
                ? 'bg-amber-600 text-white'
                : 'border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {current.restricted ? '✓ Restricted only' : 'Restricted only'}
          </Link>
        </div>
      </div>

      <UsersList
        key={JSON.stringify(current)}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{
          role,
          search: current.search || undefined,
          verificationStatus,
          banned: current.banned,
          restricted: current.restricted || undefined,
          sort: current.sort,
          dir: current.dir,
          specialization: current.specialization || undefined,
          level: current.level || undefined,
          qualification: current.qualification || undefined,
          stream: current.stream || undefined,
          state: current.state || undefined,
          accepting: current.accepting || undefined,
          universityId: current.universityId || undefined,
        }}
      />
    </DashboardShell>
  );
}
