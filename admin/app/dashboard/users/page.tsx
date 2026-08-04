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

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; search?: string }>;
}) {
  const { role: rawRole, search } = await searchParams;
  const role = ROLE_TABS.includes(rawRole as (typeof ROLE_TABS)[number])
    ? rawRole
    : 'ALL';

  const params = new URLSearchParams({ limit: '50' });
  if (role && role !== 'ALL') params.set('role', role);
  if (search) params.set('search', search);

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

      <div className="mb-4 flex gap-2">
        {ROLE_TABS.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/users?role=${tab}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
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
