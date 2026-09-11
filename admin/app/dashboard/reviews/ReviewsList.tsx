'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
import { SortableHeader } from '../../../components/SortableHeader';
import { ReviewRow } from './ReviewRow';
import { ReviewsBulkBar } from './ReviewsBulkBar';
import { loadMoreReviews, type ModeratedReview, type ReviewFilters } from './actions';

export function ReviewsList({
  initialItems,
  initialCursor,
  filters,
}: {
  initialItems: ModeratedReview[];
  initialCursor: string | null;
  filters: ReviewFilters;
}) {
  return (
    <InfiniteList
      variant="table"
      tableHead={
        <tr>
          <Table.HeadCell className="w-8" />
          <SortableHeader label="Rating" sortKey="rating" />
          <Table.HeadCell>Review</Table.HeadCell>
          <Table.HeadCell>Author / For</Table.HeadCell>
          <SortableHeader label="Status" sortKey="status" />
          <Table.HeadCell className="text-right">Actions</Table.HeadCell>
        </tr>
      }
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreReviews(filters, cursor)}
      selectable={{ getId: (review) => review.id }}
      renderBulkBar={(ctx) => <ReviewsBulkBar ctx={ctx} />}
      renderItem={(review, selection) => (
        <ReviewRow key={`${review.id}|${review.status}`} review={review} selection={selection} />
      )}
      emptyText="No reviews match this filter."
    />
  );
}
