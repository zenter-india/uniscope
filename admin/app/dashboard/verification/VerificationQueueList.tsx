'use client';

import { useState } from 'react';
import { EmptyState, Table } from '../../../components/ui';
import { VerificationBulkBar } from './VerificationBulkBar';
import { VerificationRow, type VerificationRequestRow } from './VerificationRow';

export function VerificationQueueList({ initialQueue }: { initialQueue: VerificationRequestRow[] }) {
  const [items, setItems] = useState(initialQueue);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (items.length === 0) {
    return (
      <EmptyState icon="shieldCheck">
        No pending verification requests. New submissions show up here in FIFO order.
      </EmptyState>
    );
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {selectedIds.size > 0 && (
        <VerificationBulkBar
          selectedIds={[...selectedIds]}
          totalShown={items.length}
          onSelectAll={() => setSelectedIds(new Set(items.map((r) => r.id)))}
          onClear={() => setSelectedIds(new Set())}
          onDone={(actedIds) => {
            const acted = new Set(actedIds);
            setItems((prev) => prev.filter((r) => !acted.has(r.id)));
            setSelectedIds((prev) => {
              const next = new Set(prev);
              acted.forEach((id) => next.delete(id));
              return next;
            });
          }}
        />
      )}
      <Table
        head={
          <tr>
            <Table.HeadCell className="w-8" />
            <Table.HeadCell>Applicant</Table.HeadCell>
            <Table.HeadCell>Role</Table.HeadCell>
            <Table.HeadCell>College · document</Table.HeadCell>
            <Table.HeadCell>Submitted</Table.HeadCell>
            <Table.HeadCell className="w-8" />
          </tr>
        }
      >
        {items.map((request) => (
          <VerificationRow
            key={request.id}
            request={request}
            selection={{
              checked: selectedIds.has(request.id),
              onToggle: () => toggleSelect(request.id),
            }}
          />
        ))}
      </Table>
    </div>
  );
}
