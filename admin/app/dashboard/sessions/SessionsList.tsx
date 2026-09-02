'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { SessionRow } from './SessionRow';
import { loadMoreSessions, type SessionListFilters, type SessionRowData } from './actions';

export function SessionsList({
  initialItems,
  initialCursor,
  filters,
}: {
  initialItems: SessionRowData[];
  initialCursor: string | null;
  filters: SessionListFilters;
}) {
  return (
    <InfiniteList
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreSessions(filters, cursor)}
      renderItem={(session) => <SessionRow key={session.id} session={session} />}
      emptyText="No sessions match this filter."
    />
  );
}
