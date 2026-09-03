'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
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
      variant="table"
      tableHead={
        <tr>
          <Table.HeadCell>Aspirant → Mentor</Table.HeadCell>
          <Table.HeadCell>Type</Table.HeadCell>
          <Table.HeadCell>Status</Table.HeadCell>
          <Table.HeadCell>Requested</Table.HeadCell>
          <Table.HeadCell className="w-8" />
        </tr>
      }
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreSessions(filters, cursor)}
      renderItem={(session) => <SessionRow key={session.id} session={session} />}
      emptyText="No sessions match this filter."
    />
  );
}
