'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
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
          <Table.HeadCell>Name</Table.HeadCell>
          <Table.HeadCell>Type</Table.HeadCell>
          <Table.HeadCell>Status</Table.HeadCell>
          <Table.HeadCell>Contact</Table.HeadCell>
          <Table.HeadCell>Submitted</Table.HeadCell>
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
