'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import { Icon } from './icons';
import { Table } from './ui';

/**
 * A table row that expands a detail panel below it. `cells` are the summary
 * <td> contents (each wrapped in Table.Cell); a chevron cell is appended.
 * Clicking anywhere on the summary row toggles — except on interactive
 * elements (buttons, links, inputs…), so inline actions keep working.
 */
export function ExpandableRow({
  cells,
  colSpan,
  children,
  defaultOpen = false,
}: {
  cells: ReactNode[];
  colSpan: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const onRowClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select, label')) return;
    setOpen((v) => !v);
  };

  return (
    <>
      <Table.Row
        onClick={onRowClick}
        className="cursor-pointer"
        aria-expanded={open}
      >
        {cells.map((c, i) => (
          <Table.Cell key={i}>{c}</Table.Cell>
        ))}
        <Table.Cell className="w-8 text-right text-zinc-400">
          <Icon.chevronDown
            className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </Table.Cell>
      </Table.Row>
      {open && (
        <tr className="bg-zinc-50/50">
          <td colSpan={colSpan} className="px-4 py-4">
            {children}
          </td>
        </tr>
      )}
    </>
  );
}
