'use client';

import { useState, useTransition } from 'react';
import { Button, Card } from '../../../components/ui';
import type { BulkBarContext } from '../../../components/InfiniteList';
import { toast } from '../../../lib/toast';
import { bulkSetReviewStatus, type ModeratedReview } from './actions';

export function ReviewsBulkBar({ ctx }: { ctx: BulkBarContext<ModeratedReview> }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const apply = (status: ModeratedReview['status']) => {
    setError(null);
    // The selection is only ever one `kind` at a time — the list itself
    // only ever shows one kind (the type filter tab picks mentor vs.
    // university), so every selected row shares it.
    const kind = ctx.items.find((r) => ctx.selectedIds.includes(r.id))?.kind ?? 'mentor';
    startTransition(async () => {
      const res = await bulkSetReviewStatus(kind, ctx.selectedIds, status);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const acted = new Set(ctx.selectedIds);
      ctx.updateItems((items) =>
        items.map((r) => (acted.has(r.id) ? { ...r, status } : r)),
      );
      const verb = status === 'ACTIVE' ? 'restored' : status === 'HIDDEN' ? 'hidden' : 'removed';
      toast.success(`${res.updated} review${res.updated === 1 ? '' : 's'} ${verb}.`);
      ctx.clearSelection();
    });
  };

  return (
    <Card className="flex flex-wrap items-center gap-3 border-zinc-300 bg-zinc-50 p-3">
      <span className="text-sm font-medium text-zinc-700">
        {ctx.selectedIds.length} selected
      </span>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => apply('ACTIVE')} disabled={isPending}>
          {isPending ? 'Applying…' : 'Restore'}
        </Button>
        <Button
          size="sm"
          onClick={() => apply('HIDDEN')}
          disabled={isPending}
          className="border-amber-200 text-amber-700 hover:bg-amber-50"
        >
          Hide
        </Button>
        <Button size="sm" variant="danger" onClick={() => apply('REMOVED')} disabled={isPending}>
          Remove
        </Button>
      </div>
      {error && <span className="text-sm text-red-600">{error}</span>}
      <div className="ml-auto flex gap-3 text-xs">
        <button
          type="button"
          onClick={ctx.selectAllShown}
          className="text-zinc-500 underline hover:text-zinc-700"
        >
          Select all {ctx.items.length} shown
        </button>
        <button
          type="button"
          onClick={ctx.clearSelection}
          className="text-zinc-500 underline hover:text-zinc-700"
        >
          Clear
        </button>
      </div>
    </Card>
  );
}
