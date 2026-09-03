'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { Button, EmptyState, Table } from './ui';

interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

/**
 * Client-side "Load more" wrapper for the dashboard's cursor-paginated list
 * endpoints. The server component renders the first page and hands us its
 * `nextCursor`; each click calls `loadMore(cursor)` (a server action, already
 * bound to the current filters by the caller) and appends the next page.
 *
 * The server component MUST give this a `key` derived from the active filters
 * so a filter change remounts it with a fresh first page — otherwise the
 * accumulated `items` state would survive the navigation and show stale rows.
 */
export function InfiniteList<T>({
  initialItems,
  initialCursor,
  loadMore,
  renderItem,
  emptyText = 'Nothing here yet.',
  gapClass = 'gap-3',
  variant = 'stack',
  tableHead,
}: {
  initialItems: T[];
  initialCursor: string | null;
  loadMore: (cursor: string) => Promise<Page<T>>;
  renderItem: (item: T) => ReactNode;
  emptyText?: string;
  gapClass?: string;
  /** 'table' renders rows inside a framed <table> — `renderItem` must return
   * a <tr> and `tableHead` supplies the <tr> of column headers. */
  variant?: 'stack' | 'table';
  tableHead?: ReactNode;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const more = () => {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await loadMore(cursor);
        setItems((prev) => [...prev, ...next.data]);
        setCursor(next.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load more');
      }
    });
  };

  if (items.length === 0) {
    return <EmptyState>{emptyText}</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-4">
      {variant === 'table' ? (
        <Table head={tableHead}>{items.map(renderItem)}</Table>
      ) : (
        <div className={`flex flex-col ${gapClass}`}>{items.map(renderItem)}</div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        {cursor ? (
          <Button onClick={more} disabled={isPending}>
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        ) : null}
        <span className="text-xs text-zinc-400">
          {items.length} shown{cursor ? '' : ' · end of list'}
        </span>
      </div>
    </div>
  );
}
