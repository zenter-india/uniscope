import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/* ------------------------------------------------------------------ *
 * Shared UI primitives — a small, deliberately plain design system.
 * Clean neutral palette: white surfaces on a faint grey app background,
 * hairline zinc borders, near-black primary, restrained semantic colour.
 * ------------------------------------------------------------------ */

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ---- Button -------------------------------------------------------------

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'dangerSolid'
  | 'successSolid'
  | 'ghost';
type ButtonSize = 'sm' | 'md';

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

/** A framed, horizontally-scrollable data table. Pass `<Table.Head>` rows in
 * `head` and `<Table.Row>`/`<Table.Cell>` in children. */
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
        'overflow-x-auto rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_1px_1px_rgb(0_0_0/0.03)]',
        className,
      )}
    >
      <table className="w-full border-collapse text-sm">
        {head && (
          <thead className="border-b border-zinc-200 bg-zinc-50/60 text-left">{head}</thead>
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

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}
