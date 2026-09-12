'use client';

import { InfiniteList } from '../../../components/InfiniteList';
import { Table } from '../../../components/ui';
import { SortableHeader } from '../../../components/SortableHeader';
import { UserRow, type UserRowData } from './UserRow';
import { UsersBulkBar } from './UsersBulkBar';
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
          <Table.HeadCell className="w-8" />
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
      selectable={{ getId: (user) => user.id }}
      renderBulkBar={(ctx) => <UsersBulkBar ctx={ctx} />}
      renderItem={(user, selection) => (
        <UserRow key={`${user.id}|${user.isBanned}`} user={user} selection={selection} />
      )}
      emptyText="No users match this filter."
      emptyIcon="users"
    />
  );
}
