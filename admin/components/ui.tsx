import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Icon, type IconName } from './icons';

/* ------------------------------------------------------------------ *
 * Shared UI primitives — a small, deliberately plain design system.
 * Clean neutral palette: white surfaces on a faint grey app background,
 * hairline zinc borders, near-black primary, restrained semantic colour.
 * ------------------------------------------------------------------ */

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ---- Button -------------------------------------------------------------

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'dangerSolid'
  | 'successSolid'
  | 'ghost';
export type ButtonSize = 'sm' | 'md';

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50';

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-3.5 text-sm',
};

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-800',
  secondary: 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  dangerSolid: 'bg-red-600 text-white hover:bg-red-700',
  successSolid: 'bg-emerald-600 text-white hover:bg-emerald-700',
  ghost: 'text-zinc-600 hover:bg-zinc-100',
};

function buttonClass(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return cx(BTN_BASE, BTN_SIZE[size], BTN_VARIANT[variant], className);
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// ---- Badge -------------------------------------------------------------

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'bg-zinc-100 text-zinc-600',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Map common status strings to a badge tone. */
export function toneFor(status: string): Tone {
  const s = status.toUpperCase();
  if (['VERIFIED', 'ACTIVE', 'COMPLETED', 'CONVERTED', 'PAID'].includes(s)) return 'success';
  if (['SUBMITTED', 'UNDER_REVIEW', 'PENDING', 'PROCESSING', 'CONTACTED', 'RINGING', 'ACCEPTED'].includes(s))
    return 'warning';
  if (['REJECTED', 'REMOVED', 'FAILED', 'SUSPENDED', 'BANNED', 'OPEN'].includes(s)) return 'danger';
  if (['IN_PROGRESS', 'NEW'].includes(s)) return 'info';
  return 'neutral';
}

// ---- Card -------------------------------------------------------------

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cx(
        'rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_1px_1px_rgb(0_0_0/0.03)]',
        className,
      )}
      {...props}
    />
  );
}

// ---- Table --------------------------------------------------------------

/** A framed, scrollable data table. Pass `<Table.Head>` rows in `head` and
 * `<Table.Row>`/`<Table.Cell>` in children.
 *
 * The header row is sticky (`top-0` within this component's own scroll
 * box) so column labels stay visible while scrolling a long list. This
 * needs its own bounded-height scroll container, not a page-level sticky
 * header — `overflow-x-auto` alone (for wide tables on narrow viewports)
 * forces the *y* axis to compute to `auto` too per the CSS overflow spec
 * (you can't pair `overflow-x: auto` with a real `overflow-y: visible`),
 * which silently makes this div `thead`'s sticky containing block; since
 * the div's height was unbounded it never actually scrolled, so the
 * `thead` just sat at its normal flow position and scrolled away with the
 * page instead of sticking. Capping the height and scrolling both axes on
 * the same box (`max-h-[70vh] overflow-auto`) makes that containing block
 * a real, own-scrolling box, so `sticky top-0` on `thead` works as
 * intended — same trade as most spreadsheet-style "frozen header" grids: a
 * short list looks identical to before (no internal scrollbar appears
 * until content exceeds the cap), a long one scrolls inside its own frame
 * instead of stretching the whole page. */
export function Table({
  head,
  children,
  className,
}: {
  head?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'max-h-[70vh] overflow-auto rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_1px_1px_rgb(0_0_0/0.03)]',
        className,
      )}
    >
      <table className="w-full border-collapse text-sm">
        {head && (
          <thead className="sticky top-0 z-[5] border-b border-zinc-200 bg-zinc-50/95 text-left backdrop-blur-sm">
            {head}
          </thead>
        )}
        <tbody className="divide-y divide-zinc-100">{children}</tbody>
      </table>
    </div>
  );
}

Table.HeadCell = function HeadCell({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={cx(
        'px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500',
        className,
      )}
      {...props}
    />
  );
};

Table.Row = function Row({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cx('transition-colors hover:bg-zinc-50/70', className)} {...props} />;
};

Table.Cell = function Cell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cx('px-4 py-3 align-middle text-zinc-700', className)} {...props} />;
};

// ---- Form fields ----------------------------------------------------------

/** Shared field styling for <input>/<select>/<textarea>. */
export const fieldClass =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/40';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cx(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cx(fieldClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cx(fieldClass, className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cx(
        'text-xs font-medium uppercase tracking-wide text-zinc-400',
        className,
      )}
      {...props}
    />
  );
}

// ---- Page header --------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---- Filter tabs ------------------------------------------------------

export function FilterTabs<T extends string | number>({
  items,
  current,
  hrefFor,
  size = 'md',
  labelFor,
}: {
  items: readonly T[];
  current: T;
  hrefFor: (item: T) => string;
  size?: 'sm' | 'md';
  labelFor?: (item: T) => string;
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const active = item === current;
        return (
          <Link
            key={item}
            href={hrefFor(item)}
            className={cx(
              'rounded-md font-medium transition-colors',
              pad,
              active
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100',
            )}
          >
            {labelFor ? labelFor(item) : item}
          </Link>
        );
      })}
    </div>
  );
}

// ---- Empty state -----------------------------------------------------

export function EmptyState({
  icon,
  action,
  children,
}: {
  /** Optional icon shown above the message in a soft circle badge. */
  icon?: IconName;
  /** Optional secondary action, e.g. "Clear filters" — rendered below the
   * message. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const IconCmp = icon ? Icon[icon] : null;
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-12 text-center">
      {IconCmp && (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
          <IconCmp className="h-5 w-5" />
        </span>
      )}
      <p className="max-w-sm text-sm text-zinc-500">{children}</p>
      {action}
    </div>
  );
}

// ---- Loading skeletons ---------------------------------------------------

/** A single pulsing placeholder bar. Compose with a fixed height/width via
 * `className` (e.g. `h-3.5 w-24`). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-zinc-200/70', className)} />;
}

/** A skeleton shaped like a framed `Table` — for a route's `loading.tsx`
 * while its real data is still being fetched. */
export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <div className="flex gap-8 border-b border-zinc-200 bg-zinc-50/60 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-8 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className={j === 0 ? 'h-3.5 w-32' : 'h-3.5 w-16'} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
