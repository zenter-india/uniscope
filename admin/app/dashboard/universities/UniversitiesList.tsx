'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { UniversityRow, type UniversityRowData } from './UniversityRow';
import { loadMoreUniversities, type UniversityListFilters } from './actions';

export function UniversitiesList({
  initialItems,
  initialCursor,
  filters,
}: {
  initialItems: UniversityRowData[];
  initialCursor: string | null;
  filters: UniversityListFilters;
}) {
  return (
    <InfiniteList
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreUniversities(filters, cursor)}
      renderItem={(university) => (
        <UniversityRow key={university.id} university={university} />
      )}
      emptyText="No universities match this filter."
    />
  );
}
