'use client';

import { useState, useTransition } from 'react';
import { Button, Card } from '../../../components/ui';
import { toast } from '../../../lib/toast';
import { bulkReviewVerificationRequests } from './actions';

export function VerificationBulkBar({
  selectedIds,
  totalShown,
  onDone,
  onClear,
  onSelectAll,
}: {
  selectedIds: string[];
  totalShown: number;
  onDone: (actedIds: string[]) => void;
  onClear: () => void;
  onSelectAll: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const apply = (approve: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await bulkReviewVerificationRequests(selectedIds, approve);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      const failedIds = new Set(res.failed.map((f) => f.id));
      const actedIds = selectedIds.filter((id) => !failedIds.has(id));
      onDone(actedIds);
      if (res.failed.length > 0) {
        const msg = `${res.reviewed} ${approve ? 'approved' : 'rejected'}, ${res.failed.length} failed.`;
        setError(msg);
        toast.error(msg);
      } else {
        toast.success(
          `${res.reviewed} request${res.reviewed === 1 ? '' : 's'} ${approve ? 'approved' : 'rejected'}.`,
        );
      }
    });
  };

  return (
    <Card className="flex flex-wrap items-center gap-3 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {selectedIds.length} selected
      </span>
      <div className="flex flex-wrap gap-2">
        <Button variant="successSolid" size="sm" onClick={() => apply(true)} disabled={isPending}>
          {isPending ? 'Applying…' : 'Approve'}
        </Button>
        <Button variant="dangerSolid" size="sm" onClick={() => apply(false)} disabled={isPending}>
          {isPending ? 'Applying…' : 'Reject'}
        </Button>
      </div>
      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      <div className="ml-auto flex gap-3 text-xs">
        <button
          type="button"
          onClick={onSelectAll}
          className="text-zinc-500 dark:text-zinc-400 underline hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Select all {totalShown} shown
        </button>
        <button
          type="button"
          onClick={onClear}
          className="text-zinc-500 dark:text-zinc-400 underline hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Clear
        </button>
      </div>
    </Card>
  );
}
