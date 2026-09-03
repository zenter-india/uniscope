'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
import { SortableHeader } from '../../../components/SortableHeader';
import { UserRow, type UserRowData } from './UserRow';
import { loadMoreUsers, type UserListFilters } from './actions';

export function UsersList({
  initialItems,
  initialCursor,
  filters,
}: {
  initialItems: UserRowData[];
  initialCursor: string | null;
  filters: UserListFilters;
}) {
  return (
    <InfiniteList
      variant="table"
      tableHead={
        <tr>
          <SortableHeader label="User" sortKey="name" />
          <SortableHeader label="Role" sortKey="role" />
          <SortableHeader label="Verification" sortKey="verification" />
          <SortableHeader label="Joined" sortKey="joined" />
          <Table.HeadCell className="text-right">Actions</Table.HeadCell>
        </tr>
      }
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreUsers(filters, cursor)}
      renderItem={(user) => <UserRow key={user.id} user={user} />}
      emptyText="No users match this filter."
    />
  );
}
