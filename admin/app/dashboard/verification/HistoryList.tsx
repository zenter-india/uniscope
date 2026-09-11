'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
import { VerificationHistoryRow } from './VerificationHistoryRow';
import {
  loadMoreVerificationHistory,
  type VerificationHistoryFilters,
  type VerificationHistoryRowData,
} from './actions';

export function HistoryList({
  initialItems,
  initialCursor,
  filters,
}: {
  initialItems: VerificationHistoryRowData[];
  initialCursor: string | null;
  filters: VerificationHistoryFilters;
}) {
  return (
    <InfiniteList
      variant="table"
      tableHead={
        <tr>
          <Table.HeadCell>Applicant</Table.HeadCell>
          <Table.HeadCell>College</Table.HeadCell>
          <Table.HeadCell>Decision</Table.HeadCell>
          <Table.HeadCell>Reviewed</Table.HeadCell>
          <Table.HeadCell>Note</Table.HeadCell>
        </tr>
      }
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreVerificationHistory(filters, cursor)}
      renderItem={(request) => (
        <VerificationHistoryRow key={request.id} request={request} />
      )}
      emptyText="No resolved verification requests match this filter."
    />
  );
}
