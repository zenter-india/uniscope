import { Card } from '../../../components/ui';
import { fmtDate } from './days';
import type { BucketUnit } from './types';

export interface TrendSeries {
  name: string;
  /** Any CSS colour. */
  color: string;
}

export interface TrendBar {
  /** `YYYY-MM-DD`, the start of the day, week or month. */
  bucket: string;
  /** One value per series, stacked in the same order. */
  values: number[];
}

/**
 * A stacked bar chart, one bar per day / week / month. Plain SVG, no library
 * (like the Overview's chart): bars have a hover label, and the axis words are
 * ordinary text so they never stretch with the picture.
 */
export function TrendChart({
  title,
  hint,
  bars,
  series,
  unit,
  format,
}: {
  title: string;
  hint?: string;
  bars: TrendBar[];
  series: TrendSeries[];
  unit: BucketUnit;
  /** How a value reads, e.g. "₹1,250". */
  format: (value: number) => string;
}) {
  const totals = bars.map((b) => b.values.reduce((s, v) => s + v, 0));
  const max = Math.max(...totals, 0);
  const n = Math.max(1, bars.length);
  const slot = 100 / n;
  const barWidth = slot * 0.72;
  const when = (bucket: string) =>
    unit === 'week' ? `Week of ${fmtDate(bucket, 'day')}` : fmtDate(bucket, unit);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
        </div>
        {series.length > 1 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            {series.map((s) => (
              <li key={s.name} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {max === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-300 px-3 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nothing in this range.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
            Tallest bar: {format(max)}
          </p>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="mt-1 h-32 w-full"
            role="img"
            aria-label={title}
          >
            {bars.map((b, i) => {
              let used = 0;
              // One string, not several pieces: a <title> made of separate text
              // nodes is read back differently by the browser than the server
              // wrote it, which breaks hydration.
              const tip = `${when(b.bucket)}: ${
                series.length > 1
                  ? series.map((s, k) => `${s.name} ${format(b.values[k] ?? 0)}`).join(' · ')
                  : format(b.values[0] ?? 0)
              }`;
              return (
                <g key={b.bucket}>
                  <title>{tip}</title>
                  {/* an invisible full-height strip so a short bar is easy to hover */}
                  <rect x={i * slot} y={0} width={slot} height={100} fill="transparent" />
                  {series.map((s, k) => {
                    const h = ((b.values[k] ?? 0) / max) * 100;
                    const y = 100 - used - h;
                    used += h;
                    return h > 0 ? (
                      <rect
                        key={s.name}
                        x={i * slot + (slot - barWidth) / 2}
                        y={y}
                        width={barWidth}
                        height={h}
                        fill={s.color}
                        rx={0.4}
                      />
                    ) : null;
                  })}
                </g>
              );
            })}
          </svg>
          <div className="mt-1 flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
            <span>{when(bars[0].bucket)}</span>
            {bars.length > 1 && <span>{when(bars[bars.length - 1].bucket)}</span>}
          </div>
        </>
      )}
    </Card>
  );
}
