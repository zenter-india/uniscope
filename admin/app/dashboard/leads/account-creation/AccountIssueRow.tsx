import Link from 'next/link';
import { Badge, Card } from '../../../../components/ui';
import {
  STEP_COPY,
  trackFor,
  type AccountStep,
  type TrackItem,
  type TrackState,
} from './accountSteps';

/** One website sign-up that has no account. Dates arrive already formatted by
 * the server page, so the browser and the server always agree on the text. */
export interface AccountIssue {
  id: string;
  fullName: string;
  role: 'ASPIRANT' | 'MENTOR';
  phone: string;
  alias: string | null;
  hasDocument: boolean;
  signedUp: string;
  /** Why creating the account failed. Null on an older sign-up with no reason
   * recorded. */
  reason: string | null;
  failedAt: string | null;
  /** The step it stopped at. Null on a failure recorded before steps were. */
  step: AccountStep | null;
}

const MARK: Record<TrackState, { glyph: string; text: string; ring: string }> = {
  done: {
    glyph: '✓',
    text: 'done',
    ring: 'bg-emerald-600 text-white dark:bg-emerald-500',
  },
  failed: {
    glyph: '✕',
    text: 'stopped here',
    ring: 'bg-red-600 text-white dark:bg-red-500',
  },
  pending: {
    glyph: '·',
    text: 'not reached',
    ring: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300',
  },
};

/** The steps a sign-up goes through, with the one it stopped at marked. */
function StepTrack({ items }: { items: TrackItem[] }) {
  return (
    <ol
      aria-label="Account creation steps"
      className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5"
    >
      {items.map((item) => {
        const mark = MARK[item.state];
        return (
          <li key={item.label} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden="true"
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold leading-none ${mark.ring}`}
            >
              {mark.glyph}
            </span>
            <span
              className={
                item.state === 'failed'
                  ? 'font-semibold text-red-700 dark:text-red-400'
                  : item.state === 'pending'
                    ? 'text-zinc-500 dark:text-zinc-400'
                    : 'text-zinc-800 dark:text-zinc-200'
              }
            >
              {item.label}
            </span>
            <span className="sr-only">({mark.text})</span>
          </li>
        );
      })}
    </ol>
  );
}

export function AccountIssueRow({ issue }: { issue: AccountIssue }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{issue.fullName}</span>
        <Badge tone={issue.role === 'MENTOR' ? 'info' : 'neutral'}>
          {issue.role === 'MENTOR' ? 'Mentor' : 'Aspirant'}
        </Badge>
        {issue.hasDocument && <Badge tone="neutral">ID uploaded</Badge>}
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {issue.phone}
        {issue.alias ? ` · alias: ${issue.alias}` : ''} · signed up {issue.signedUp}
      </p>

      {issue.reason ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          {issue.step ? (
            <div className="mb-3 border-b border-amber-200/80 pb-3 dark:border-amber-500/20">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Stopped at: {STEP_COPY[issue.step].stoppedAt}
              </p>
              <p className="mt-0.5 text-sm text-amber-900 dark:text-amber-200">
                {STEP_COPY[issue.step].outcome}
              </p>
              <StepTrack
                items={trackFor(issue.step, { role: issue.role, hasDocument: issue.hasDocument })}
              />
            </div>
          ) : (
            <p className="mb-2 text-xs text-amber-800/80 dark:text-amber-300/80">
              The step it stopped at was not recorded for this one.
            </p>
          )}
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {issue.step && STEP_COPY[issue.step].accountExists
              ? 'What went wrong'
              : 'Why the account was not created'}
          </p>
          <p className="mt-0.5 text-sm text-amber-900 dark:text-amber-200">{issue.reason}</p>
          {issue.failedAt && (
            <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80">
              {issue.failedAt}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          No reason was recorded. This is an older sign-up, from before failures were tracked.
        </p>
      )}

      <div className="mt-3">
        <Link
          href={`/dashboard/leads?search=${encodeURIComponent(issue.phone)}`}
          className="text-xs text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Open in Leads
        </Link>
      </div>
    </Card>
  );
}
