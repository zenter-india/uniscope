import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { AddUniversityForm } from './AddUniversityForm';
import type { UniversityRowData } from './UniversityRow';
import { UniversitiesList } from './UniversitiesList';

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;

  const params = new URLSearchParams({ limit: '50' });
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

      <UniversitiesList
        key={search ?? ''}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ search }}
      />
    </DashboardShell>
  );
}
