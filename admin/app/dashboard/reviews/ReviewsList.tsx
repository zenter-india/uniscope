'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
import { ReviewRow } from './ReviewRow';
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
          <Table.HeadCell>Rating</Table.HeadCell>
          <Table.HeadCell>Review</Table.HeadCell>
          <Table.HeadCell>Author / For</Table.HeadCell>
          <Table.HeadCell>Status</Table.HeadCell>
          <Table.HeadCell className="text-right">Actions</Table.HeadCell>
        </tr>
      }
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreReviews(filters, cursor)}
      renderItem={(review) => <ReviewRow key={review.id} review={review} />}
      emptyText="No reviews match this filter."
    />
  );
}
