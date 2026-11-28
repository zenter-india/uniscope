import { backendFetch } from '../../../../lib/backend';
import { getAdminEmail } from '../../../../lib/adminAuth';
import { getAccess } from '../../../../lib/access';
import { canView } from '../../../../lib/permissions';
import { EmptyState, FilterTabs } from '../../../../components/ui';
import { DashboardShell } from '../../DashboardShell';
import { AccountIssueRow, type AccountIssue } from './AccountIssueRow';
import { StoppedMentorRow, type StoppedMentor } from './StoppedMentorRow';
import { parseStep } from './accountSteps';
import { parseLeftAt } from './stoppedMentors';
import { when } from './when';

const VIEWS = ['attention', 'all'] as const;
type View = (typeof VIEWS)[number];

interface LeadStats {
  /** Absent on an older backend. */
  accountFailed?: number;
  withoutAccount?: number;
}

interface LeadFromApi {
  id: string;
  fullName: string;
  role: 'ASPIRANT' | 'MENTOR';
  phone: string;
  alias: string | null;
  hasDocument: boolean;
  createdAt: string;
  accountFailureReason?: string | null;
  accountFailedAt?: string | null;
  /** Absent on an older backend, and null on a failure from before steps were
   * recorded. */
  accountFailureStep?: string | null;
}

interface StoppedMentorFromApi {
  id: string;
  displayName: string;
  realName: string | null;
  phone: string | null;
  college: string | null;
  degree: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  source: 'website' | 'app';
  leftAt: string;
}

interface StoppedMentorsFromApi {
  data: StoppedMentorFromApi[];
  nextCursor: string | null;
  total: number;
}

const PAGE = '/dashboard/leads/account-creation';

const EXPORT_LINK_CLASS =
  'inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/60';

/** A heading for one list on this page, with its own Export CSV. */
function SectionHeader({
  title,
  count,
  exportHref,
}: {
  title: string;
  count: number | undefined;
  exportHref: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
        {count === undefined ? '' : ` (${count})`}
      </h2>
      <a href={exportHref} className={`${EXPORT_LINK_CLASS} ml-auto`}>
        Export CSV
      </a>
    </div>
  );
}

const UNAVAILABLE = (
  <p className="text-sm text-zinc-500 dark:text-zinc-400">
    This list is unavailable right now — the backend didn&apos;t respond.
  </p>
);

export default async function AccountCreationPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: raw } = await searchParams;
  const view: View = raw === 'all' ? 'all' : 'attention';

  // The mentors come from the Users section, so they are shown only to an admin
  // who can view Users (they include real names and phone numbers).
  const access = await getAccess();
  const showMentors = canView(access, 'users');

  const [email, stats, list, mentors] = await Promise.all([
    getAdminEmail(),
    backendFetch<LeadStats>('/enrollments/stats').catch(() => null),
    backendFetch<{ data: LeadFromApi[]; nextCursor: string | null }>(
      `/enrollments?account=${view === 'all' ? 'missing' : 'failed'}&limit=100&sortBy=created&sortDir=desc`,
    ).catch(() => null),
    showMentors
      ? backendFetch<StoppedMentorsFromApi>(
          // The other tab only needs the count for its label.
          `/users/stopped-mentors?limit=${view === 'attention' ? 100 : 1}`,
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  const failed = stats?.accountFailed;
  const all = stats?.withoutAccount;
  const stopped = showMentors ? mentors?.total : 0;
  const attention =
    failed === undefined && stopped === undefined ? undefined : (failed ?? 0) + (stopped ?? 0);
  const label = (v: View) =>
    v === 'attention'
      ? `Needs attention${attention === undefined ? '' : ` (${attention})`}`
      : `All without an account${all === undefined ? '' : ` (${all})`}`;

  const issues: AccountIssue[] = (list?.data ?? []).map((l) => ({
    id: l.id,
    fullName: l.fullName,
    role: l.role,
    phone: l.phone,
    alias: l.alias,
    hasDocument: l.hasDocument,
    signedUp: when(l.createdAt),
    reason: l.accountFailureReason ?? null,
    failedAt: l.accountFailedAt ? when(l.accountFailedAt) : null,
    step: parseStep(l.accountFailureStep),
  }));

  const stoppedMentors: StoppedMentor[] = (mentors?.data ?? []).map((m) => ({
    id: m.id,
    displayName: m.displayName,
    realName: m.realName,
    phone: m.phone,
    college: m.college,
    degree: m.degree,
    signedUp: when(m.createdAt),
    lastActive: m.lastActiveAt ? when(m.lastActiveAt) : null,
    source: m.source,
    leftAt: parseLeftAt(m.leftAt),
  }));

  return (
    <DashboardShell title="Account creation" email={email}>
      <p className="mb-5 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
        People who did not finish signing up: website sign-ups that did not become an account, and
        mentors who started signing up in the app but never submitted a college ID. Each shows where
        it stopped, so nobody is left waiting without anyone knowing. Export CSV downloads a list
        with that detail.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs
          items={VIEWS}
          current={view}
          hrefFor={(v) => (v === 'attention' ? PAGE : `${PAGE}?view=all`)}
          labelFor={label}
        />
        {view === 'all' && (
          <a href="/dashboard/leads/export?account=missing" className={`${EXPORT_LINK_CLASS} ml-auto`}>
            Export CSV
          </a>
        )}
      </div>

      {view === 'all' && (
        <p className="mb-4 max-w-3xl text-xs text-zinc-500 dark:text-zinc-400">
          This also lists older sign-ups with no recorded reason. Some were failures from before
          this page existed, and others are from before the website created accounts at all.
          People can still sign up in the app with the same number.
        </p>
      )}

      {view === 'all' ? (
        !list ? (
          UNAVAILABLE
        ) : issues.length === 0 ? (
          <EmptyState icon="check">Every website sign-up has an account.</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {issues.map((issue) => (
              <AccountIssueRow key={issue.id} issue={issue} />
            ))}
            {list.nextCursor && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Showing the newest 100. Use search on the Leads page to find the others.
              </p>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <SectionHeader
              title="Website sign-ups with no account"
              count={failed}
              exportHref="/dashboard/leads/export?account=failed"
            />
            {!list ? (
              UNAVAILABLE
            ) : issues.length === 0 ? (
              <EmptyState icon="check">
                No website sign-up needs attention. Every one has an account.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {issues.map((issue) => (
                  <AccountIssueRow key={issue.id} issue={issue} />
                ))}
                {list.nextCursor && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Showing the newest 100. Use search on the Leads page to find the others.
                  </p>
                )}
              </div>
            )}
          </section>

          {showMentors && (
            <section>
              <SectionHeader
                title="Mentors who stopped in the app"
                count={mentors?.total}
                exportHref="/dashboard/users/stopped-mentors/export"
              />
              <p className="mb-3 max-w-3xl text-xs text-zinc-500 dark:text-zinc-400">
                Mentors with an account whose verification is still Draft: they never submitted a
                college ID. The Users page lists them under Draft / not submitted, and labels the
                ones who never saved a profile &quot;Profile incomplete&quot;. Erased accounts are
                not included. Newest first. Someone may still be in the middle of signing up.
              </p>
              {!mentors ? (
                UNAVAILABLE
              ) : stoppedMentors.length === 0 ? (
                <EmptyState icon="check">
                  Every mentor has submitted a college ID or been verified.
                </EmptyState>
              ) : (
                <div className="flex flex-col gap-3">
                  {stoppedMentors.map((mentor) => (
                    <StoppedMentorRow key={mentor.id} mentor={mentor} />
                  ))}
                  {mentors.nextCursor && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Showing the newest 100 of {mentors.total}. Export CSV has the whole list.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
