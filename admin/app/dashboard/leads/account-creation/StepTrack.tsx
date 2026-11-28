import type { TrackItem, TrackState } from './accountSteps';

const MARK: Record<TrackState, { glyph: string; text: string; ring: string }> = {
  done: {
    glyph: '✓',
    text: 'done',
    ring: 'bg-emerald-600 text-white dark:bg-emerald-500',
  },
  failed: {
    glyph: '✕',
    text: 'stopped here',
    ring: 'bg-red-600 text-white dark:bg-red-500',
  },
  pending: {
    glyph: '·',
    text: 'not reached',
    ring: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300',
  },
};

/** A line of steps with the one a person stopped at marked. Used for a website
 * sign-up's account creation and for a mentor's sign-up in the app. */
export function StepTrack({
  items,
  label = 'Account creation steps',
}: {
  items: TrackItem[];
  label?: string;
}) {
  return (
    <ol aria-label={label} className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => {
        const mark = MARK[item.state];
        return (
          <li key={item.label} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden="true"
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold leading-none ${mark.ring}`}
            >
              {mark.glyph}
            </span>
            <span
              className={
                item.state === 'failed'
                  ? 'font-semibold text-red-700 dark:text-red-400'
                  : item.state === 'pending'
                    ? 'text-zinc-500 dark:text-zinc-400'
                    : 'text-zinc-800 dark:text-zinc-200'
              }
            >
              {item.label}
            </span>
            <span className="sr-only">({mark.text})</span>
          </li>
        );
      })}
    </ol>
  );
}
