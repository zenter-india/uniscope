'use client';

import { useState, useTransition, type ReactNode } from 'react';

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
}: {
  initialItems: T[];
  initialCursor: string | null;
  loadMore: (cursor: string) => Promise<Page<T>>;
  renderItem: (item: T) => ReactNode;
  emptyText?: string;
  gapClass?: string;
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
    return <p className="text-sm text-zinc-500">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex flex-col ${gapClass}`}>{items.map(renderItem)}</div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        {cursor ? (
          <button
            onClick={more}
            disabled={isPending}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {isPending ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
        <span className="text-xs text-zinc-400">
          {items.length} shown{cursor ? '' : ' · end of list'}
        </span>
      </div>
    </div>
  );
}
