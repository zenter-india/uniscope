import { bucketKeys, bucketStart, bucketUnitFor } from './money-buckets';

const d = (iso: string) => new Date(iso);

describe('bucketUnitFor', () => {
  it.each([
    [1, 'day'],
    [30, 'day'],
    [62, 'day'],
    [63, 'week'],
    [90, 'week'],
    [200, 'week'],
    [201, 'month'],
    [366, 'month'],
  ])('uses the right step for %i days: %s', (days, unit) => {
    expect(bucketUnitFor(days)).toBe(unit);
  });

  it('never gives a chart many more than 60 bars', () => {
    for (let days = 1; days <= 366; days++) {
      const unit = bucketUnitFor(days);
      const bars =
        unit === 'day' ? days : unit === 'week' ? days / 7 : days / 28;
      expect(bars).toBeLessThanOrEqual(63);
    }
  });
});

describe('bucketStart', () => {
  it('is the UTC midnight for a day', () => {
    expect(bucketStart(d('2026-11-24T22:15:00.000Z'), 'day')).toEqual(
      d('2026-11-24T00:00:00.000Z'),
    );
  });

  it('is the Monday for a week, like Postgres date_trunc', () => {
    // 2026-11-24 is a Tuesday
    expect(bucketStart(d('2026-11-24T10:00:00.000Z'), 'week')).toEqual(
      d('2026-11-23T00:00:00.000Z'),
    );
    // a Sunday belongs to the week that started the Monday before
    expect(bucketStart(d('2026-11-22T10:00:00.000Z'), 'week')).toEqual(
      d('2026-11-16T00:00:00.000Z'),
    );
    // a Monday is its own week
    expect(bucketStart(d('2026-11-23T00:00:00.000Z'), 'week')).toEqual(
      d('2026-11-23T00:00:00.000Z'),
    );
  });

  it('is the first of the month for a month', () => {
    expect(bucketStart(d('2026-11-24T10:00:00.000Z'), 'month')).toEqual(
      d('2026-11-01T00:00:00.000Z'),
    );
  });
});

describe('bucketKeys', () => {
  it('has a bar for every day, including the quiet ones', () => {
    expect(
      bucketKeys(
        d('2026-11-01T00:00:00.000Z'),
        d('2026-11-04T00:00:00.000Z'),
        'day',
      ),
    ).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });

  it('starts a rolling window in the middle of a day with that whole day', () => {
    expect(
      bucketKeys(
        d('2026-11-23T15:00:00.000Z'),
        d('2026-11-24T15:00:00.000Z'),
        'day',
      ),
    ).toEqual(['2026-11-23', '2026-11-24']);
  });

  it('has one bar per Monday for weeks', () => {
    expect(
      bucketKeys(
        d('2026-11-10T00:00:00.000Z'),
        d('2026-11-25T00:00:00.000Z'),
        'week',
      ),
    ).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
  });

  it('has one bar per month for months, across a year end', () => {
    expect(
      bucketKeys(
        d('2025-11-15T00:00:00.000Z'),
        d('2026-02-01T00:00:00.000Z'),
        'month',
      ),
    ).toEqual(['2025-11-01', '2025-12-01', '2026-01-01']);
  });

  it('includes the last moment before the end, not the end itself', () => {
    expect(
      bucketKeys(
        d('2026-11-01T00:00:00.000Z'),
        d('2026-11-02T00:00:00.000Z'),
        'day',
      ),
    ).toEqual(['2026-11-01']);
  });
});
