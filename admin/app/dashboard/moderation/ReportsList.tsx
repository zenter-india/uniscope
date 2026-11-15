'use client';

import { InfiniteList } from '../../../components/InfiniteList';
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
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreReports(status, cursor)}
      renderItem={(report) => (
        <ReportRow key={report.id} report={report} readOnly={readOnly} />
      )}
      emptyText="No reports in this status."
      gapClass="gap-4"
    />
  );
}
