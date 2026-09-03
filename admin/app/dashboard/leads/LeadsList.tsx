'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
import { SortableHeader } from '../../../components/SortableHeader';
import { LeadRow, type LeadRowData } from './LeadRow';
import { loadMoreLeads, type LeadListFilters } from './actions';

export function LeadsList({
  initialItems,
  initialCursor,
  filters,
}: {
  initialItems: LeadRowData[];
  initialCursor: string | null;
  filters: LeadListFilters;
}) {
  return (
    <InfiniteList
      variant="table"
      tableHead={
        <tr>
          <SortableHeader label="Name" sortKey="name" />
          <SortableHeader label="Type" sortKey="role" />
          <SortableHeader label="Status" sortKey="status" />
          <Table.HeadCell>Contact</Table.HeadCell>
          <SortableHeader label="Submitted" sortKey="created" />
          <Table.HeadCell className="w-8" />
        </tr>
      }
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreLeads(filters, cursor)}
      renderItem={(lead) => <LeadRow key={lead.id} lead={lead} />}
      emptyText="No leads match this filter."
    />
  );
}
