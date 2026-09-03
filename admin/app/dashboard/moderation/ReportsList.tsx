'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
import { ReportRow, type ReportRowData } from './ReportRow';
import { loadMoreReports } from './actions';

export function ReportsList({
  initialItems,
  initialCursor,
  status,
  readOnly,
}: {
  initialItems: ReportRowData[];
  initialCursor: string | null;
  status: string;
  readOnly: boolean;
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
      loadMore={(cursor) => loadMoreReports(status, cursor)}
      renderItem={(report) => (
        <ReportRow key={report.id} report={report} readOnly={readOnly} />
      )}
      emptyText="No reports in this status."
    />
  );
}
