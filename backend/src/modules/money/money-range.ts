import { BadRequestException } from '@nestjs/common';
import {
  MAX_CUSTOM_DAYS,
  dayKey,
  parseUtcDay,
} from '../metrics/metrics.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The period a Money view is built for. */
export interface MoneyRange {
  /** Inclusive start. */
  since: Date;
  /** Exclusive end. */
  until: Date;
  /** The picked days (UTC, inclusive) for a custom range; null for a rolling
   * 24h / 7d / 30d / 90d window. */
  range: { from: string; to: string } | null;
  /** Days covered (a rolling 24h is 1). */
  days: number;
}

/**
 * The same range rules as the Overview: either a rolling window of `days`
 * (1, 7, 30 or 90 — 30 when nothing is sent) ending now, or a custom range of
 * whole UTC days, `from` and `to` both included. A `to` in the future is cut
 * back to today and echoed back in `range`.
 */
export function resolveMoneyRange(
  query: { days?: number; from?: string; to?: string },
  now: Date = new Date(),
): MoneyRange {
  if (query.from || query.to) {
    if (!query.from || !query.to) {
      throw new BadRequestException(
        'Send both from and to for a custom range.',
      );
    }
    const start = parseUtcDay(query.from);
    const end = parseUtcDay(query.to);
    if (!start || !end) {
      throw new BadRequestException(
        'from and to must be real dates written YYYY-MM-DD.',
      );
    }
    const today = parseUtcDay(dayKey(now))!;
    if (start > today) {
      throw new BadRequestException('The range cannot start in the future.');
    }
    const lastDay = end > today ? today : end;
    if (lastDay < start) {
      throw new BadRequestException('"to" cannot be before "from".');
    }
    const days = Math.round((lastDay.getTime() - start.getTime()) / DAY_MS) + 1;
    if (days > MAX_CUSTOM_DAYS) {
      throw new BadRequestException(
        `Pick a range of at most ${MAX_CUSTOM_DAYS} days.`,
      );
    }
    return {
      since: start,
      until: new Date(lastDay.getTime() + DAY_MS),
      range: { from: query.from, to: dayKey(lastDay) },
      days,
    };
  }

  const days = query.days ?? 30;
  return {
    since: new Date(now.getTime() - days * DAY_MS),
    until: now,
    range: null,
    days,
  };
}
