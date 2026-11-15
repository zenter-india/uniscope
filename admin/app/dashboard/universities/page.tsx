import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { AddUniversityForm } from './AddUniversityForm';
import type { UniversityRowData } from './UniversityRow';
import { UniversitiesList } from './UniversitiesList';

const TYPE_TABS = ['ALL', 'GOVERNMENT', 'PRIVATE', 'DEEMED', 'CENTRAL'] as const;

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; search?: string }>;
}) {
  const { type: rawType, search } = await searchParams;
  const type = TYPE_TABS.includes(rawType as (typeof TYPE_TABS)[number]) ? rawType : 'ALL';

  const params = new URLSearchParams({ limit: '50' });
  if (type && type !== 'ALL') params.set('type', type);
  if (search) params.set('search', search);

  const [email, page] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: UniversityRowData[]; nextCursor: string | null }>(
      `/universities/admin/list?${params.toString()}`,
    ).catch(() => ({ data: [], nextCursor: null })),
  ]);

  return (
    <DashboardShell title="Universities" email={email}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <form className="flex gap-2" action="/dashboard/universities">
          {type && type !== 'ALL' && <input type="hidden" name="type" value={type} />}
          <input
            type="text"
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by name, city, state..."
            className="w-72 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Search
          </button>
        </form>
        <AddUniversityForm />
      </div>

      <div className="mb-4 flex gap-2">
        {TYPE_TABS.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/universities?type=${tab}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              type === tab
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab}
          </Link>
        ))}
      </div>

      <UniversitiesList
        key={`${type}|${search ?? ''}`}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ type, search }}
      />
    </DashboardShell>
  );
}
