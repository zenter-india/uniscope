'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Badge, Button, Table } from '../../../components/ui';
import { loadMoreTopups } from './actions';
import { PLATFORM_LABEL, fmtWhen, inr, shownName } from './days';
import type { MoneyQuery, MoneyTopup, Platform } from './types';

const PLATFORM_TONE = {
  ios: 'info',
  android: 'success',
  web: 'warning',
} as const;

function PlatformBadge({ platform }: { platform: Platform | null }) {
  if (!platform) return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
  return <Badge tone={PLATFORM_TONE[platform]}>{PLATFORM_LABEL[platform]}</Badge>;
}

/**
 * Who recharged, on which platform, for how many minutes. The first page comes
 * from the server; "Load more" asks for the next one with the same filters.
 */
export function TopupsTable({
  query,
  initialRows,
  initialCursor,
}: {
  query: MoneyQuery;
  initialRows: MoneyTopup[];
  initialCursor: string | null;
}) {
  const [rows, setRows] = useState(initialRows);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadMore = () => {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      const res = await loadMoreTopups(query, cursor);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows((prev) => [...prev, ...res.data]);
      setCursor(res.nextCursor);
    });
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No top-ups match this range and filter.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Table
        head={
          <tr>
            <Table.HeadCell>When</Table.HeadCell>
            <Table.HeadCell>User</Table.HeadCell>
            <Table.HeadCell>Platform</Table.HeadCell>
            <Table.HeadCell>Uniminutes</Table.HeadCell>
            <Table.HeadCell>Paid</Table.HeadCell>
          </tr>
        }
      >
        {rows.map((t) => (
          <Table.Row key={t.id}>
            <Table.Cell className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
              {fmtWhen(t.createdAt)}
            </Table.Cell>
            <Table.Cell>
              <Link
                href={`/dashboard/users/${t.userId}`}
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                {shownName(t.userName)}
              </Link>
              {t.uniqueId && (
                <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">{t.uniqueId}</span>
              )}
            </Table.Cell>
            <Table.Cell>
              <PlatformBadge platform={t.platform} />
            </Table.Cell>
            <Table.Cell>{t.uniminutes.toLocaleString('en-IN')}</Table.Cell>
            <Table.Cell>
              {t.paidMinor !== null ? (
                inr(t.paidMinor)
              ) : (
                <span
                  className="text-zinc-400 dark:text-zinc-500"
                  title="The App Store sets the price and keeps its cut, so no rupee amount is recorded."
                >
                  Not recorded
                </span>
              )}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Showing {rows.length} top-up{rows.length === 1 ? '' : 's'}
          {cursor ? '' : ' — that is all of them'}.
        </p>
        {cursor && (
          <Button size="sm" onClick={loadMore} disabled={isPending}>
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        )}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
