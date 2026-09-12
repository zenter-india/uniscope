'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
import { ReportRow, type ReportRowData } from './ReportRow';
import { loadMoreReports, type ReportListFilters } from './actions';

const READONLY_STATUSES = new Set(['RESOLVED', 'DISMISSED']);

export function ReportsList({
  initialItems,
  initialCursor,
  filters,
}: {
  initialItems: ReportRowData[];
  initialCursor: string | null;
  filters: ReportListFilters;
}) {
  return (
    <InfiniteList
      variant="table"
      tableHead={
        <tr>
          <Table.HeadCell>Reason</Table.HeadCell>
          <Table.HeadCell>Reported by</Table.HeadCell>
          <Table.HeadCell>Target</Table.HeadCell>
          <Table.HeadCell>Date</Table.HeadCell>
          <Table.HeadCell className="w-8" />
        </tr>
      }
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreReports(filters, cursor)}
      renderItem={(report) => (
        <ReportRow
          key={report.id}
          report={report}
          readOnly={READONLY_STATUSES.has(report.status)}
        />
      )}
      emptyText="No reports in this status."
      emptyIcon="flag"
    />
  );
}
