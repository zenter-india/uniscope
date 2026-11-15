'use client';

import { InfiniteList } from '../../../components/InfiniteList';
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
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadMoreUsers(filters, cursor)}
      renderItem={(user) => <UserRow key={user.id} user={user} />}
      emptyText="No users match this filter."
    />
  );
}
