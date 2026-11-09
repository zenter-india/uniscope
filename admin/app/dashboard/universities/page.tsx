import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { ButtonLink } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import { AddUniversityForm } from './AddUniversityForm';
import type { UniversityRowData } from './UniversityRow';
import { UniversitiesList } from './UniversitiesList';
import { UniversityFilters } from './UniversityFilters';

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; course?: string; sort?: string }>;
}) {
  const { search, course, sort: rawSort } = await searchParams;
  // A–Z unless Z–A or "Newest first" is picked explicitly.
  const sort: 'name' | 'name_desc' | 'new' =
    rawSort === 'new' || rawSort === 'name_desc' ? rawSort : 'name';

  const params = new URLSearchParams({ limit: '50' });
  if (search) params.set('search', search);
  if (course) params.set('course', course);
  if (sort !== 'new') params.set('sort', sort);

  const [email, page, courses] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: UniversityRowData[]; nextCursor: string | null }>(
      `/universities/admin/list?${params.toString()}`,
    ).catch(() => ({ data: [], nextCursor: null })),
    // The Course dropdown simply stays at "All courses" if this is unavailable.
    backendFetch<{ name: string; colleges: number }[]>('/universities/admin/courses').catch(
      () => [],
    ),
  ]);

  return (
    <DashboardShell title="Universities" email={email}>
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        The college catalogue mentors verify against and students browse. Deactivate
        rather than delete — a deactivated college drops off the app but stays here.
      </p>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <UniversityFilters
          search={search ?? ''}
          course={course ?? ''}
          sort={sort}
          courses={courses}
        />
        <div className="flex items-center gap-2">
          <ButtonLink href="/dashboard/universities/duplicates">Find duplicates</ButtonLink>
          <AddUniversityForm />
        </div>
      </div>

      <UniversitiesList
        key={`${search ?? ''}|${course ?? ''}|${sort}`}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ search, course, sort }}
      />
    </DashboardShell>
  );
}
