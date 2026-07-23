import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { AddUniversityForm } from './AddUniversityForm';
import { UniversityRow } from './UniversityRow';

interface UniversityRowData {
  id: string;
  name: string;
  slug: string;
  type: string;
  state: string;
  city: string;
  nirfRank: number | null;
  mbbsSeats: number | null;
  establishedYear: number | null;
  website: string | null;
  description: string | null;
  isActive: boolean;
}

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

      {page.data.length === 0 ? (
        <p className="text-sm text-zinc-500">No universities match this filter.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {page.data.map((university) => (
            <UniversityRow key={university.id} university={university} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
