'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
import { SortableHeader } from '../../../components/SortableHeader';
import { SessionRow } from './SessionRow';
import { SessionsBulkBar } from './SessionsBulkBar';
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
          <Table.HeadCell className="w-8" />
          <Table.HeadCell>Aspirant → Mentor</Table.HeadCell>
          <Table.HeadCell>Type</Table.HeadCell>
          <SortableHeader label="Status" sortKey="status" />
          <SortableHeader label="Requested" sortKey="requested" />
          <Table.HeadCell className="w-8" />
        </tr>
      }
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreSessions(filters, cursor)}
      selectable={{ getId: (session) => session.id }}
      renderBulkBar={(ctx) => <SessionsBulkBar ctx={ctx} />}
      renderItem={(session, selection) => (
        <SessionRow key={`${session.id}|${session.status}`} session={session} selection={selection} />
      )}
      emptyText="No sessions match this filter."
      emptyIcon="clock"
    />
  );
}
