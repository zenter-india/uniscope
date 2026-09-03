'use client';

import { InfiniteList } from '../../../components/InfiniteList';
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
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreReviews(filters, cursor)}
      renderItem={(review) => <ReviewRow key={review.id} review={review} />}
      emptyText="No reviews match this filter."
    />
  );
}
