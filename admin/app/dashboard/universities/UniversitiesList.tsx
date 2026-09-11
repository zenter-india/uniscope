'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
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
      variant="table"
      tableHead={
        <tr>
          <Table.HeadCell>College</Table.HeadCell>
          <Table.HeadCell>Location</Table.HeadCell>
          <Table.HeadCell>Status</Table.HeadCell>
          <Table.HeadCell className="text-right">Actions</Table.HeadCell>
        </tr>
      }
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
