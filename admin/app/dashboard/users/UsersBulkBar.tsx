'use client';

import { useState, useTransition } from 'react';
import { Button, Card } from '../../../components/ui';
import { ConfirmButton } from '../../../components/ConfirmButton';
import type { BulkBarContext } from '../../../components/InfiniteList';
import { toast } from '../../../lib/toast';
import { bulkSetUsersBanned } from './actions';
import type { UserRowData } from './UserRow';

export function UsersBulkBar({ ctx }: { ctx: BulkBarContext<UserRowData> }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const apply = (banned: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await bulkSetUsersBanned(ctx.selectedIds, banned);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      const acted = new Set(ctx.selectedIds);
      ctx.updateItems((items) =>
        items.map((u) => (acted.has(u.id) ? { ...u, isBanned: banned } : u)),
      );
      toast.success(
        `${res.updated} user${res.updated === 1 ? '' : 's'} ${banned ? 'banned' : 'unbanned'}.`,
      );
      ctx.clearSelection();
    });
  };

  return (
    <Card className="flex flex-wrap items-center gap-3 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {ctx.selectedIds.length} selected
      </span>
      <div className="flex flex-wrap gap-2">
        <ConfirmButton onConfirm={() => apply(true)} disabled={isPending}>
          {isPending ? 'Applying…' : 'Ban'}
        </ConfirmButton>
        <Button size="sm" onClick={() => apply(false)} disabled={isPending}>
          {isPending ? 'Applying…' : 'Unban'}
        </Button>
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
