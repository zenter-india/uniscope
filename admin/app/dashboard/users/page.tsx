import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { FilterTabs } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import type { UserRowData } from './UserRow';
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

function buildHref(params: {
  role?: string;
  verificationStatus?: string;
  banned?: string;
  search?: string;
}) {
  const qs = new URLSearchParams();
  if (params.role && params.role !== 'ALL') qs.set('role', params.role);
  if (params.verificationStatus && params.verificationStatus !== 'ALL')
    qs.set('verificationStatus', params.verificationStatus);
  if (params.banned === '1') qs.set('banned', '1');
  if (params.search) qs.set('search', params.search);
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
  }>;
}) {
  const {
    role: rawRole,
    search,
    verificationStatus: rawVerification,
    banned: rawBanned,
  } = await searchParams;
  const role = ROLE_TABS.includes(rawRole as (typeof ROLE_TABS)[number])
    ? rawRole
    : 'ALL';
  const verificationStatus = VERIFICATION_TABS.includes(
    rawVerification as (typeof VERIFICATION_TABS)[number],
  )
    ? rawVerification!
    : 'ALL';
  const banned = rawBanned === '1';

  const params = new URLSearchParams({ limit: '50' });
  if (role && role !== 'ALL') params.set('role', role);
  if (search) params.set('search', search);
  if (verificationStatus !== 'ALL') params.set('verificationStatus', verificationStatus);
  if (banned) params.set('isBanned', 'true');

  const [email, page] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: UserRowData[]; nextCursor: string | null }>(
      `/users?${params.toString()}`,
    ).catch(() => ({ data: [], nextCursor: null })),
  ]);

  return (
    <DashboardShell title="Users" email={email}>
      <div className="mb-5 flex flex-col gap-3">
        <form className="flex gap-2" action="/dashboard/users">
          {role && role !== 'ALL' && <input type="hidden" name="role" value={role} />}
          {verificationStatus !== 'ALL' && (
            <input type="hidden" name="verificationStatus" value={verificationStatus} />
          )}
          {banned && <input type="hidden" name="banned" value="1" />}
          <input
            type="text"
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by display name…"
            className="w-72 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/40"
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
            hrefFor={(tab) =>
              buildHref({ role: tab, verificationStatus, banned: banned ? '1' : undefined, search })
            }
          />
          <FilterTabs
            size="sm"
            items={VERIFICATION_TABS}
            current={verificationStatus as (typeof VERIFICATION_TABS)[number]}
            hrefFor={(tab) =>
              buildHref({ role, verificationStatus: tab, banned: banned ? '1' : undefined, search })
            }
            labelFor={(tab) => (tab === 'ALL' ? 'Any verification' : tab.replace('_', ' '))}
          />
          <Link
            href={buildHref({ role, verificationStatus, banned: banned ? undefined : '1', search })}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              banned
                ? 'bg-red-600 text-white'
                : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-100'
            }`}
          >
            {banned ? '✓ Banned only' : 'Banned only'}
          </Link>
        </div>
      </div>

      <UsersList
        key={`${role}|${verificationStatus}|${banned}|${search ?? ''}`}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ role, search, verificationStatus, banned }}
      />
    </DashboardShell>
  );
}
