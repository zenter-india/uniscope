export type BucketUnit = 'day' | 'week' | 'month';

/** A bar per day for up to two months, per week up to about half a year, per
 * month beyond that — so a chart never has more than ~60 bars. */
export function bucketUnitFor(days: number): BucketUnit {
  if (days <= 62) return 'day';
  if (days <= 200) return 'week';
  return 'month';
}

/** The first moment (UTC) of the day, week (Monday, like Postgres) or month
 * that `d` falls in. */
export function bucketStart(d: Date, unit: BucketUnit): Date {
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  if (unit === 'week') {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  } else if (unit === 'month') {
    start.setUTCDate(1);
  }
  return start;
}

function nextBucket(d: Date, unit: BucketUnit): Date {
  const next = new Date(d);
  if (unit === 'day') next.setUTCDate(next.getUTCDate() + 1);
  else if (unit === 'week') next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

/** `YYYY-MM-DD` of the start of every bucket that touches [since, until), so a
 * chart has a bar for each one even when nothing happened in it. */
export function bucketKeys(
  since: Date,
  until: Date,
  unit: BucketUnit,
): string[] {
  const last = bucketStart(new Date(until.getTime() - 1), unit);
  const keys: string[] = [];
  for (
    let cur = bucketStart(since, unit);
    cur <= last;
    cur = nextBucket(cur, unit)
  ) {
    keys.push(cur.toISOString().slice(0, 10));
  }
  return keys;
}
