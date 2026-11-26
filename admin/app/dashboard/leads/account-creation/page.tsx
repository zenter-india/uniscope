import { backendFetch } from '../../../../lib/backend';
import { getAdminEmail } from '../../../../lib/adminAuth';
import { EmptyState, FilterTabs } from '../../../../components/ui';
import { DashboardShell } from '../../DashboardShell';
import { AccountIssueRow, type AccountIssue } from './AccountIssueRow';
import { parseStep } from './accountSteps';

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

/** UTC like the Money page, written here on the server so the text never
 * differs between the server and the browser. */
function when(iso: string): string {
  return `${new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })} UTC`;
}

const PAGE = '/dashboard/leads/account-creation';

export default async function AccountCreationPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: raw } = await searchParams;
  const view: View = raw === 'all' ? 'all' : 'attention';

  const [email, stats, list] = await Promise.all([
    getAdminEmail(),
    backendFetch<LeadStats>('/enrollments/stats').catch(() => null),
    backendFetch<{ data: LeadFromApi[]; nextCursor: string | null }>(
      `/enrollments?account=${view === 'all' ? 'missing' : 'failed'}&limit=100&sortBy=created&sortDir=desc`,
    ).catch(() => null),
  ]);

  const failed = stats?.accountFailed;
  const all = stats?.withoutAccount;
  const label = (v: View) =>
    v === 'attention'
      ? `Needs attention${failed === undefined ? '' : ` (${failed})`}`
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

  return (
    <DashboardShell title="Account creation" email={email}>
      <p className="mb-5 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
        Website sign-ups that did not become an account. When creating the account fails, the
        step it stopped at and the reason are recorded here straight away, so nobody is left
        waiting without anyone knowing. Retry account re-runs the creation with the details saved
        on the sign-up.
      </p>

      <div className="mb-4">
        <FilterTabs
          items={VIEWS}
          current={view}
          hrefFor={(v) => (v === 'attention' ? PAGE : `${PAGE}?view=all`)}
          labelFor={label}
        />
      </div>

      {view === 'all' && (
        <p className="mb-4 max-w-3xl text-xs text-zinc-500 dark:text-zinc-400">
          This also lists older sign-ups with no recorded reason. Some were failures from before
          this page existed, and others are from before the website created accounts at all.
          People can still sign up in the app with the same number.
        </p>
      )}

      {!list ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          This list is unavailable right now — the backend didn&apos;t respond.
        </p>
      ) : issues.length === 0 ? (
        <EmptyState icon="check">
          {view === 'attention'
            ? 'No sign-up needs attention. Every website sign-up has an account.'
            : 'Every website sign-up has an account.'}
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
    </DashboardShell>
  );
}
