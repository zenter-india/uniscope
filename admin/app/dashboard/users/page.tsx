import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { UserRow } from './UserRow';

interface UserRowData {
  id: string;
  displayName: string;
  role: string;
  verificationStatus: string;
  isBanned: boolean;
  isActive: boolean;
  createdAt: string;
}

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
      <form className="mb-4 flex gap-2" action="/dashboard/users">
        {role && role !== 'ALL' && <input type="hidden" name="role" value={role} />}
        {verificationStatus !== 'ALL' && (
          <input type="hidden" name="verificationStatus" value={verificationStatus} />
        )}
        {banned && <input type="hidden" name="banned" value="1" />}
        <input
          type="text"
          name="search"
          defaultValue={search ?? ''}
          placeholder="Search by display name..."
          className="w-72 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
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
            href={buildHref({ role: tab, verificationStatus, banned: banned ? '1' : undefined, search })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              role === tab
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab}
          </Link>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {VERIFICATION_TABS.map((tab) => (
          <Link
            key={tab}
            href={buildHref({ role, verificationStatus: tab, banned: banned ? '1' : undefined, search })}
            className={`rounded-lg px-3 py-1 text-xs font-medium ${
              verificationStatus === tab
                ? 'bg-zinc-700 text-white'
                : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-100'
            }`}
          >
            {tab === 'ALL' ? 'Any verification' : tab.replace('_', ' ')}
          </Link>
        ))}
      </div>

      <div className="mb-4">
        <Link
          href={buildHref({ role, verificationStatus, banned: banned ? undefined : '1', search })}
          className={`rounded-lg px-3 py-1 text-xs font-medium ${
            banned
              ? 'bg-red-600 text-white'
              : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-100'
          }`}
        >
          {banned ? '✓ Banned only' : 'Banned only'}
        </Link>
      </div>

      {page.data.length === 0 ? (
        <p className="text-sm text-zinc-500">No users match this filter.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {page.data.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
