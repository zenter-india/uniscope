import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { ButtonLink } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import { AddUniversityForm } from './AddUniversityForm';
import type { UniversityRowData } from './UniversityRow';
import { UniversitiesList } from './UniversitiesList';
import { UniversityFilters } from './UniversityFilters';

interface FilterOption {
  name: string;
  colleges: number;
}

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    course?: string;
    sort?: string;
    state?: string;
    stream?: string;
    status?: string;
  }>;
}) {
  const { search, course, state, stream, sort: rawSort, status: rawStatus } = await searchParams;
  // A–Z unless Z–A or "Newest first" is picked explicitly.
  const sort: 'name' | 'name_desc' | 'new' =
    rawSort === 'new' || rawSort === 'name_desc' ? rawSort : 'name';
  // "Inactive" = hidden from the app (e.g. a college a user typed that no admin
  // has published yet); anything else lists both.
  const status: '' | 'active' | 'inactive' =
    rawStatus === 'active' || rawStatus === 'inactive' ? rawStatus : '';

  const params = new URLSearchParams({ limit: '50' });
  if (search) params.set('search', search);
  if (course) params.set('course', course);
  if (state) params.set('state', state);
  if (stream) params.set('stream', stream);
  if (status) params.set('status', status);
  if (sort !== 'new') params.set('sort', sort);

  const [email, page, courses, options] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: UniversityRowData[]; nextCursor: string | null }>(
      `/universities/admin/list?${params.toString()}`,
    ).catch(() => ({ data: [], nextCursor: null })),
    // The dropdowns simply stay at "All …" if these are unavailable.
    backendFetch<FilterOption[]>('/universities/admin/courses').catch(() => []),
    backendFetch<{ states: FilterOption[]; streams: FilterOption[] }>(
      '/universities/admin/filter-options',
    ).catch(() => ({ states: [], streams: [] })),
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
          state={state ?? ''}
          stream={stream ?? ''}
          status={status}
          course={course ?? ''}
          sort={sort}
          states={options.states}
          streams={options.streams}
          courses={courses}
        />
        <div className="flex items-center gap-2">
          <ButtonLink href="/dashboard/universities/duplicates">Find duplicates</ButtonLink>
          <AddUniversityForm />
        </div>
      </div>

      <UniversitiesList
        key={`${search ?? ''}|${course ?? ''}|${state ?? ''}|${stream ?? ''}|${status}|${sort}`}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ search, course, state, stream, status: status || undefined, sort }}
      />
    </DashboardShell>
  );
}
