'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Card } from '../../../../components/ui';
import { toast } from '../../../../lib/toast';
import { eraseUser } from './actions';

/**
 * GDPR "right to erasure" for a user account. Irreversible, so it's gated
 * behind typing the exact display name. On success the account is now an
 * anonymous stub — send the admin back to the list.
 */
export function DangerZone({
  userId,
  displayName,
  alreadyErased,
}: {
  userId: string;
  displayName: string;
  alreadyErased: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (alreadyErased) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Data erasure</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          This account has already been erased — personal data was wiped and the login
          identity scrambled. The row is kept only as an anonymous stub for the
          sessions, wallet and reviews that reference it.
        </p>
      </Card>
    );
  }

  const canErase = confirmText.trim() === displayName && !isPending;

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = await eraseUser(userId);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`${displayName} erased.`);
      router.push('/dashboard/users');
      router.refresh();
    });
  };

  return (
    <Card className="border-red-200 dark:border-red-500/30 p-5">
      <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone — delete profile</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        GDPR erasure. Wipes the real name, phone, display name and every profile field,
        and scrambles the login identity so the account can never be recovered or
        re-created from the same phone. Sessions, wallet balance, ledger history and
        reviews are kept but no longer linked to a real person.{' '}
        <span className="font-medium text-zinc-800 dark:text-zinc-100">This cannot be undone.</span>
      </p>

      {!open ? (
        <Button variant="danger" size="sm" className="mt-3" onClick={() => setOpen(true)}>
          Delete this profile…
        </Button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs text-zinc-600 dark:text-zinc-300">
            Type <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{displayName}</span> to
            confirm
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            className="w-72 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-red-400 dark:focus:border-red-500 focus:ring-2 focus:ring-red-400/40 dark:focus:ring-red-500/30"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button variant="dangerSolid" size="sm" onClick={run} disabled={!canErase}>
              {isPending ? 'Erasing…' : 'Erase account permanently'}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                setConfirmText('');
                setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
