'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Badge, Button, Card, Input } from '../../../../components/ui';
import { toast } from '../../../../lib/toast';
import { retryLeadAccount } from '../actions';

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
}

export function AccountIssueRow({ issue }: { issue: AccountIssue }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alias, setAlias] = useState(issue.alias ?? '');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const retry = () => {
    setError(null);
    startTransition(async () => {
      const res = await retryLeadAccount(issue.id, alias);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setDone(true);
      toast.success('Account created.');
      // Refresh the list and the counts: this sign-up no longer belongs here.
      router.refresh();
    });
  };

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
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Why the account was not created
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

      {done ? (
        <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Account created.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {open ? (
            <>
              <div className="flex min-w-[220px] flex-col gap-1">
                <label
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                  htmlFor={`alias-${issue.id}`}
                >
                  Alias for the account
                </label>
                <Input
                  id={`alias-${issue.id}`}
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Leave empty to use what they typed"
                  maxLength={60}
                />
              </div>
              <Button size="sm" variant="primary" onClick={retry} disabled={isPending}>
                {isPending ? 'Creating…' : 'Create account'}
              </Button>
              <Button size="sm" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <p className="w-full text-xs text-zinc-500 dark:text-zinc-400">
                Uses the details{issue.hasDocument ? ' and document' : ''} saved on this sign-up.
                If the alias is taken, the next free one is used (for example John1) and the
                person is notified.
              </p>
            </>
          ) : (
            <Button size="sm" onClick={() => setOpen(true)} disabled={isPending}>
              Retry account
            </Button>
          )}
          <Link
            href={`/dashboard/leads?search=${encodeURIComponent(issue.phone)}`}
            className="text-xs text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Open in Leads
          </Link>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Card>
  );
}
