import Link from 'next/link';
import { getAdminEmail } from '../../../lib/adminAuth';
import { Button, Card, EmptyState, Input, PageHeader } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import { PermissionsPanel } from './PermissionsPanel';
import { getUserPermissions, searchPermissionUsers } from './actions';

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; user?: string }>;
}) {
  const { search = '', user: userId } = await searchParams;
  const email = await getAdminEmail();
  const term = search.trim();

  const [results, selected] = await Promise.all([
    term.length >= 2 ? searchPermissionUsers(term).catch(() => []) : Promise.resolve([]),
    userId ? getUserPermissions(userId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <DashboardShell title="Permissions" email={email}>
      <PageHeader
        title="Permissions"
        description="Allow or deny what an aspirant or mentor can do in the app. Everything is allowed by default: tick a box to allow, untick to deny. A denied action is blocked in the app as soon as you save."
      />

      <form className="mb-5 flex max-w-xl gap-2" action="/dashboard/permissions">
        <Input name="search" defaultValue={search} placeholder="Search by display name or unique ID" />
        <Button type="submit">Search</Button>
      </form>

      <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
        <div>
          {term.length >= 2 && results.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No app users match this search.</p>
          )}
          {results.length > 0 && (
            <Card className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {results.map((u) => (
                <Link
                  key={u.id}
                  href={`/dashboard/permissions?search=${encodeURIComponent(search)}&user=${u.id}`}
                  className={`block px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                    u.id === userId ? 'bg-zinc-100 dark:bg-zinc-900' : ''
                  }`}
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{u.displayName}</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {u.role}
                    {u.uniqueId ? ` · ${u.uniqueId}` : ''}
                  </span>
                </Link>
              ))}
            </Card>
          )}
        </div>

        <div>
          {selected ? (
            <PermissionsPanel key={selected.user.id} initial={selected} />
          ) : (
            <EmptyState icon="lock">
              {userId
                ? 'Could not load this user. They may have been removed, or the backend is unavailable.'
                : 'Search for an aspirant or mentor, then choose them to manage their permissions.'}
            </EmptyState>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
