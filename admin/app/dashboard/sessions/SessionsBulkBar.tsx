'use client';

import { useState, useTransition } from 'react';
import { Card } from '../../../components/ui';
import { ConfirmButton } from '../../../components/ConfirmButton';
import type { BulkBarContext } from '../../../components/InfiniteList';
import { toast } from '../../../lib/toast';
import { bulkForceEndSessions, type SessionRowData } from './actions';

export function SessionsBulkBar({ ctx }: { ctx: BulkBarContext<SessionRowData> }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const apply = () => {
    setError(null);
    startTransition(async () => {
      const res = await bulkForceEndSessions(ctx.selectedIds);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      const failedIds = new Set(res.failed.map((f) => f.id));
      const endedIds = new Set(ctx.selectedIds.filter((id) => !failedIds.has(id)));
      ctx.updateItems((items) =>
        items.map((s) => (endedIds.has(s.id) ? { ...s, status: 'FAILED', endReason: 'ADMIN_CLOSED' } : s)),
      );
      if (res.failed.length > 0) {
        const msg = `${res.ended} ended, ${res.failed.length} failed.`;
        setError(msg);
        toast.error(msg);
      } else {
        toast.success(`${res.ended} session${res.ended === 1 ? '' : 's'} force-ended.`);
      }
      ctx.clearSelection();
    });
  };

  return (
    <Card className="flex flex-wrap items-center gap-3 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {ctx.selectedIds.length} selected
      </span>
      <ConfirmButton variant="danger" onConfirm={apply} disabled={isPending}>
        {isPending ? 'Ending…' : 'Force end'}
      </ConfirmButton>
      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      <div className="ml-auto flex gap-3 text-xs">
        <button
          type="button"
          onClick={ctx.selectAllShown}
          className="text-zinc-500 dark:text-zinc-400 underline hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Select all {ctx.items.length} shown
        </button>
        <button
          type="button"
          onClick={ctx.clearSelection}
          className="text-zinc-500 dark:text-zinc-400 underline hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Clear
        </button>
      </div>
    </Card>
  );
}
