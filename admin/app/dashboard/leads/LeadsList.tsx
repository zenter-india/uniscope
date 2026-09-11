'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
import { SortableHeader } from '../../../components/SortableHeader';
import { LeadRow, type LeadRowData } from './LeadRow';
import { LeadsBulkBar } from './LeadsBulkBar';
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
          <Table.HeadCell className="w-8" />
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
      selectable={{ getId: (lead) => lead.id }}
      renderBulkBar={(ctx) => <LeadsBulkBar ctx={ctx} />}
      renderItem={(lead, selection) => (
        <LeadRow key={`${lead.id}|${lead.status}`} lead={lead} selection={selection} />
      )}
      emptyText="No leads match this filter."
      emptyIcon="message"
    />
  );
}
