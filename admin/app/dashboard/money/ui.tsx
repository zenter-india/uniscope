import { Card } from '../../../components/ui';

export const EXPORT_LINK =
  'inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 max-md:h-10 max-md:text-sm';

/** "▲ 12% vs the period before" — how a number moved against the equally long
 * period right before. Quiet when both are zero; "new" when it started from
 * nothing. `neutral` skips the green and red for numbers where up is not good
 * news in itself. */
export function Delta({
  current,
  previous,
  neutral = false,
}: {
  current: number;
  previous: number;
  neutral?: boolean;
}) {
  if (current === 0 && previous === 0) return null;
  const quiet = 'text-zinc-500 dark:text-zinc-400';
  if (previous === 0) {
    return <span className={`text-xs ${quiet}`}>new — nothing in the period before</span>;
  }
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.005) {
    return <span className={`text-xs ${quiet}`}>no change vs the period before</span>;
  }
  const up = change > 0;
  const tone = neutral
    ? quiet
    : up
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';
  return (
    <span className={`text-xs ${tone}`}>
      {up ? '▲' : '▼'} {Math.abs(change * 100).toFixed(0)}% vs the period before
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
      {delta && <p className="mt-1">{delta}</p>}
    </Card>
  );
}

export function SectionHeading({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      {children}
    </p>
  );
}

export function Unavailable({ what }: { what: string }) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400">
      {what} is unavailable right now — the backend didn&apos;t respond.
    </p>
  );
}

/** A thin horizontal bar showing a 0..1 share, with the number beside it. */
export function ShareBar({ share, label }: { share: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
        role="img"
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-zinc-700 dark:bg-zinc-300"
          style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{label}</span>
    </div>
  );
}

/** Reminder printed under figures that rest on very few people. */
export function SmallNumbers() {
  return (
    <p className="text-xs text-zinc-400 dark:text-zinc-500">
      With so few payers, a percentage moves a lot from one person — read it together with the
      count beside it.
    </p>
  );
}
