'use client';

import { InfiniteList } from '../../../components/InfiniteList';
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
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreLeads(filters, cursor)}
      renderItem={(lead) => <LeadRow key={lead.id} lead={lead} />}
      emptyText="No leads match this filter."
    />
  );
}
