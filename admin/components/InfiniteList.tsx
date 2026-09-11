'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { Button, EmptyState, Table } from './ui';
import type { IconName } from './icons';

interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export interface RowSelection {
  checked: boolean;
  onToggle: () => void;
}

export interface BulkBarContext<T> {
  selectedIds: string[];
  items: T[];
  clearSelection: () => void;
  selectAllShown: () => void;
  /** Patch the locally-held items after a bulk action succeeds — e.g. map
   * the acted-on rows to their new status — without a full re-fetch. */
  updateItems: (updater: (items: T[]) => T[]) => void;
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
 *
 * Optional bulk-selection support: pass `selectable` (how to get a stable id
 * from an item) and `renderBulkBar` (the action bar shown once ≥1 row is
 * selected — typically a handful of "Mark N as …" buttons). `renderItem`
 * then receives a second `selection` argument whenever `selectable` is set,
 * for the row to render its own checkbox cell (see LeadRow/ReviewRow).
 */
export function InfiniteList<T>({
  initialItems,
  initialCursor,
  loadMore,
  renderItem,
  emptyText = 'Nothing here yet.',
  emptyIcon,
  gapClass = 'gap-3',
  variant = 'stack',
  tableHead,
  selectable,
  renderBulkBar,
}: {
  initialItems: T[];
  initialCursor: string | null;
  loadMore: (cursor: string) => Promise<Page<T>>;
  renderItem: (item: T, selection?: RowSelection) => ReactNode;
  emptyText?: string;
  emptyIcon?: IconName;
  gapClass?: string;
  /** 'table' renders rows inside a framed <table> — `renderItem` must return
   * a <tr> and `tableHead` supplies the <tr> of column headers. */
  variant?: 'stack' | 'table';
  tableHead?: ReactNode;
  selectable?: { getId: (item: T) => string };
  renderBulkBar?: (ctx: BulkBarContext<T>) => ReactNode;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
    return <EmptyState icon={emptyIcon}>{emptyText}</EmptyState>;
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectionFor = (item: T): RowSelection | undefined => {
    if (!selectable) return undefined;
    const id = selectable.getId(item);
    return { checked: selectedIds.has(id), onToggle: () => toggleSelect(id) };
  };

  const bulkBarCtx: BulkBarContext<T> | null = selectable
    ? {
        selectedIds: [...selectedIds],
        items,
        clearSelection: () => setSelectedIds(new Set()),
        selectAllShown: () => setSelectedIds(new Set(items.map(selectable.getId))),
        updateItems: (updater) => setItems(updater),
      }
    : null;

  return (
    <div className="flex flex-col gap-4">
      {bulkBarCtx && selectedIds.size > 0 && renderBulkBar && (
        <div>{renderBulkBar(bulkBarCtx)}</div>
      )}

      {variant === 'table' ? (
        <Table head={tableHead}>{items.map((item) => renderItem(item, selectionFor(item)))}</Table>
      ) : (
        <div className={`flex flex-col ${gapClass}`}>
          {items.map((item) => renderItem(item, selectionFor(item)))}
        </div>
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
