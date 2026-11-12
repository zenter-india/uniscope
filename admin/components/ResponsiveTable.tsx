'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The framed data table behind `Table` (see ui.tsx). On desktop it is the same
 * scrolling table as always. Below the `md` breakpoint (see `.rtable` in
 * globals.css) every row is shown as a card instead — a phone can't fit 5–7
 * columns, and scrolling sideways hid the very columns an admin needs
 * (the status and the Approve / Reject buttons).
 *
 * The card needs each cell's column name. Rather than touching every page, the
 * labels are read from the header row after render and written onto the cells
 * as `data-label`; a MutationObserver keeps them right as rows are appended by
 * "load more" / infinite scroll or expanded in place.
 *
 *  - `data-primary`  the first real cell: the row's title, shown without a label
 *  - `data-kind=check`  a bulk-select checkbox, pinned top-left of the card
 *  - `data-kind=icon`   a lone chevron/icon cell, pinned top-right
 *  - `data-label=""`    an Actions cell: full width, no label
 *  - `data-row`         a short single value: label left, value right
 */
export function ResponsiveTable({
  head,
  children,
  className,
  headClassName,
  bodyClassName,
}: {
  head?: ReactNode;
  children: ReactNode;
  className: string;
  headClassName: string;
  bodyClassName: string;
}) {
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const label = () => {
      const heads = Array.from(table.querySelectorAll('thead th')).map(
        (th) => th.textContent?.trim() ?? '',
      );
      table.querySelectorAll('tbody > tr').forEach((tr) => {
        let hasPrimary = tr.querySelector('td[data-primary]') !== null;
        Array.from(tr.children).forEach((cell, index) => {
          if (!(cell instanceof HTMLTableCellElement) || cell.tagName !== 'TD') return;
          // Expanded detail rows / inline edit forms span the whole row.
          if (cell.colSpan > 1) return;
          // Already the row's title (this runs again whenever a row changes).
          if (cell.hasAttribute('data-primary')) return;

          const text = cell.textContent?.trim() ?? '';
          const hasCheckbox = cell.querySelector('input[type="checkbox"]') !== null;
          const hasControl = cell.querySelector('button, a, input, select, textarea') !== null;

          if (hasCheckbox && !text) {
            cell.dataset.kind = 'check';
            return;
          }
          if (!text && !hasControl && cell.querySelector('svg')) {
            cell.dataset.kind = 'icon';
            return;
          }
          if (!hasPrimary) {
            cell.dataset.primary = '';
            cell.dataset.label = '';
            hasPrimary = true;
            return;
          }
          const header = heads[index] ?? '';
          const isActions = /^actions?$/i.test(header);
          cell.dataset.label = isActions ? '' : header;
          // A short, single value sits beside its label; anything longer or
          // made of several parts gets the full width below the label.
          const short = !isActions && !hasControl && cell.children.length <= 1 && text.length <= 40;
          if (short) cell.dataset.row = '';
          else delete cell.dataset.row;
        });
      });
    };

    label();
    const observer = new MutationObserver(label);
    observer.observe(table, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className={className}>
      <table ref={tableRef} className="w-full border-collapse text-sm">
        {head && <thead className={headClassName}>{head}</thead>}
        <tbody className={bodyClassName}>{children}</tbody>
      </table>
    </div>
  );
}
