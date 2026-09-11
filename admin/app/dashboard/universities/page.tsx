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
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        The college catalogue mentors verify against and students browse. Deactivate
        rather than delete — a deactivated college drops off the app but stays here.
      </p>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <form className="flex gap-2" action="/dashboard/universities">
          <input
            type="text"
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by name, city, state…"
            className="w-72 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-2 focus:ring-zinc-400/40 dark:focus:ring-zinc-600/40"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
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
