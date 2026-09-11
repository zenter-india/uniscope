'use client';

import { useState, useTransition } from 'react';
import { Button, Card } from '../../../components/ui';
import type { BulkBarContext } from '../../../components/InfiniteList';
import { toast } from '../../../lib/toast';
import { bulkUpdateLeadStatus } from './actions';
import type { LeadRowData } from './LeadRow';

const STATUS_OPTIONS = ['CONTACTED', 'CONVERTED', 'REJECTED'] as const;

export function LeadsBulkBar({ ctx }: { ctx: BulkBarContext<LeadRowData> }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const apply = (status: (typeof STATUS_OPTIONS)[number]) => {
    setError(null);
    startTransition(async () => {
      const res = await bulkUpdateLeadStatus(ctx.selectedIds, status);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      const acted = new Set(ctx.selectedIds);
      ctx.updateItems((items) =>
        items.map((l) => (acted.has(l.id) ? { ...l, status } : l)),
      );
      toast.success(`${res.updated} lead${res.updated === 1 ? '' : 's'} marked ${status.toLowerCase()}.`);
      ctx.clearSelection();
    });
  };

  return (
    <Card className="flex flex-wrap items-center gap-3 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {ctx.selectedIds.length} selected
      </span>
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <Button key={s} size="sm" onClick={() => apply(s)} disabled={isPending}>
            {isPending ? 'Applying…' : `Mark ${s.charAt(0) + s.slice(1).toLowerCase()}`}
          </Button>
        ))}
      </div>
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
