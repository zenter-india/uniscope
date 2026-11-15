'use client';

import { useState } from 'react';

const CHIP =
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors max-md:py-2.5';
const CHIP_ON = 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900';
const CHIP_OFF =
  'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800';

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` shifted by whole days (UTC, no clock/timezone surprises). */
function shift(day: string, days: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * The "Custom" chip beside 24h / 7d / 30d / 90d. Clicking it opens a small
 * panel to pick the first and last day (the phone's own date picker is used),
 * plus a few one-tap shortcuts. It is a plain GET form: the Overview reads
 * `from` / `to` from the address, so a custom view can be bookmarked or shared.
 * Days are counted in UTC, same as the charts.
 */
export function CustomRangePicker({
  from,
  to,
  today,
  label,
}: {
  /** The active custom range, or '' when a preset is selected. */
  from: string;
  to: string;
  /** Today's date (UTC), the latest day that can be picked. */
  today: string;
  /** Text for the chip when a custom range is active, e.g. "3 Nov – 9 Nov". */
  label: string;
}) {
  const active = from !== '' && to !== '';
  const [open, setOpen] = useState(active);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);

  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = shift(monthStart, -1);
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`;

  const shortcuts: { text: string; from: string; to: string }[] = [
    { text: 'Yesterday', from: shift(today, -1), to: shift(today, -1) },
    { text: 'This month', from: monthStart, to: today },
    { text: 'Last month', from: lastMonthStart, to: lastMonthEnd },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF}`}
      >
        {active ? `Custom · ${label}` : 'Custom'}
      </button>

      {open && (
        <form
          method="get"
          action="/dashboard"
          className="basis-full rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[9.5rem] flex-1 flex-col gap-1 text-xs font-medium uppercase tracking-wide text-zinc-500 sm:flex-none dark:text-zinc-400">
              From
              <input
                type="date"
                name="from"
                required
                value={start}
                max={end || today}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex min-w-[9.5rem] flex-1 flex-col gap-1 text-xs font-medium uppercase tracking-wide text-zinc-500 sm:flex-none dark:text-zinc-400">
              To
              <input
                type="date"
                name="to"
                required
                value={end}
                min={start || undefined}
                max={today}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Apply
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Quick pick</span>
            {shortcuts.map((s) => (
              <a
                key={s.text}
                href={`/dashboard?from=${s.from}&to=${s.to}`}
                className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {s.text}
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            Whole days, counted in UTC like the charts. Compared with the same number of days right
            before.
          </p>
        </form>
      )}
    </>
  );
}
