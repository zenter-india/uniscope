'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon } from './icons';

/**
 * A clickable table header cell that sorts the list. Writes `sort=<key>` and
 * `dir=asc|desc` into the URL; clicking the active column flips the
 * direction. The page reads these params, forwards them to the backend, and
 * keys its list on them so the accumulated rows reset on a sort change.
 */
export function SortableHeader({
  label,
  sortKey,
  className,
  align = 'left',
}: {
  label: string;
  sortKey: string;
  className?: string;
  align?: 'left' | 'right';
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  const activeSort = params.get('sort');
  const activeDir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const isActive = activeSort === sortKey;
  const nextDir = isActive && activeDir === 'desc' ? 'asc' : 'desc';

  const next = new URLSearchParams(params.toString());
  next.set('sort', sortKey);
  next.set('dir', nextDir);
  next.delete('cursor');

  return (
    <th
      className={
        'px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500 ' +
        (align === 'right' ? 'text-right ' : '') +
        (className ?? '')
      }
    >
      <Link
        href={`${pathname}?${next.toString()}`}
        scroll={false}
        className={
          'group inline-flex items-center gap-1 transition-colors hover:text-zinc-800 ' +
          (align === 'right' ? 'flex-row-reverse' : '')
        }
      >
        {label}
        <Icon.chevronDown
          className={
            'h-3.5 w-3.5 transition ' +
            (isActive
              ? `text-zinc-700 ${activeDir === 'asc' ? 'rotate-180' : ''}`
              : 'text-zinc-300 opacity-0 group-hover:opacity-100')
          }
        />
      </Link>
    </th>
  );
}
