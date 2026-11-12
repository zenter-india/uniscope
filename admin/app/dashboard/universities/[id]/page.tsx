import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BackendApiError, backendFetch } from '../../../../lib/backend';
import { getAdminEmail } from '../../../../lib/adminAuth';
import { Badge, Card } from '../../../../components/ui';
import { DashboardShell } from '../../DashboardShell';
import { locationLabel } from '../location';
import { CollegePeople, type CollegePerson } from './CollegePeople';

interface CollegePage {
  college: {
    id: string;
    name: string;
    state: string;
    city: string | null;
    district: string | null;
    stream: string | null;
    isActive: boolean;
  };
  mentors: CollegePerson[];
  aspirants: CollegePerson[];
  truncated: { mentors: boolean; aspirants: boolean };
}

export default async function CollegeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: CollegePage | null = null;
  let failed = false;
  try {
    data = await backendFetch<CollegePage>(`/universities/admin/${encodeURIComponent(id)}/people`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    failed = true;
  }
  const email = await getAdminEmail();

  // A college that was merged away opens the one it was merged into.
  if (data && data.college.id !== id) redirect(`/dashboard/universities/${data.college.id}`);

  return (
    <DashboardShell title={data?.college.name ?? 'College'} email={email}>
      <Link
        href="/dashboard/universities"
        className="mb-4 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Back to universities
      </Link>

      {!data ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {failed ? 'Could not load this college — the backend did not answer.' : ''}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {data.college.name}
              </h1>
              {data.college.stream && <Badge>{data.college.stream}</Badge>}
              <Badge tone={data.college.isActive ? 'success' : 'danger'}>
                {data.college.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{locationLabel(data.college)}</p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {data.aspirants.length} student{data.aspirants.length === 1 ? '' : 's'} ·{' '}
              {data.mentors.length} mentor{data.mentors.length === 1 ? '' : 's'}
              {!data.college.isActive && ' · not published, so it is hidden from the app'}
            </p>
            <p className="mt-3 text-xs">
              <Link
                href={`/dashboard/universities?search=${encodeURIComponent(data.college.name)}`}
                className="text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
              >
                Edit, merge or deactivate in the list
              </Link>
            </p>
          </Card>

          <CollegePeople
            aspirants={data.aspirants}
            mentors={data.mentors}
            truncated={data.truncated}
          />
        </div>
      )}
    </DashboardShell>
  );
}
