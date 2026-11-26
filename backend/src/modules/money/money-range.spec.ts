import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { resolveMoneyRange } from './money-range';

const NOW = new Date('2026-11-24T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

describe('resolveMoneyRange', () => {
  it('is the last 30 days ending now when nothing is sent', () => {
    const r = resolveMoneyRange({}, NOW);
    expect(r.days).toBe(30);
    expect(r.range).toBeNull();
    expect(r.until).toEqual(NOW);
    expect(r.since).toEqual(new Date(NOW.getTime() - 30 * DAY));
  });

  it.each([1, 7, 90])('is a rolling window for the %i-day preset', (days) => {
    const r = resolveMoneyRange({ days }, NOW);
    expect(r.days).toBe(days);
    expect(r.since).toEqual(new Date(NOW.getTime() - days * DAY));
    expect(r.until).toEqual(NOW);
  });

  it('takes a custom range as whole UTC days, both included', () => {
    const r = resolveMoneyRange({ from: '2026-11-01', to: '2026-11-10' }, NOW);
    expect(r.since).toEqual(new Date('2026-11-01T00:00:00.000Z'));
    expect(r.until).toEqual(new Date('2026-11-11T00:00:00.000Z'));
    expect(r.range).toEqual({ from: '2026-11-01', to: '2026-11-10' });
    expect(r.days).toBe(10);
  });

  it('lets a custom range win over the preset', () => {
    const r = resolveMoneyRange(
      { days: 7, from: '2026-11-01', to: '2026-11-03' },
      NOW,
    );
    expect(r.days).toBe(3);
    expect(r.range).toEqual({ from: '2026-11-01', to: '2026-11-03' });
  });

  it('cuts a "to" in the future back to today and says so', () => {
    const r = resolveMoneyRange({ from: '2026-11-20', to: '2026-12-31' }, NOW);
    expect(r.range).toEqual({ from: '2026-11-20', to: '2026-11-24' });
    expect(r.until).toEqual(new Date('2026-11-25T00:00:00.000Z'));
    expect(r.days).toBe(5);
  });

  it('accepts a single day', () => {
    const r = resolveMoneyRange({ from: '2026-11-24', to: '2026-11-24' }, NOW);
    expect(r.days).toBe(1);
  });

  it('refuses a range that starts in the future', () => {
    expect(() =>
      resolveMoneyRange({ from: '2026-12-01', to: '2026-12-05' }, NOW),
    ).toThrow(BadRequestException);
  });

  it('refuses "to" before "from"', () => {
    expect(() =>
      resolveMoneyRange({ from: '2026-11-10', to: '2026-11-01' }, NOW),
    ).toThrow(BadRequestException);
  });

  it('refuses one end without the other', () => {
    expect(() => resolveMoneyRange({ from: '2026-11-01' }, NOW)).toThrow(
      BadRequestException,
    );
    expect(() => resolveMoneyRange({ to: '2026-11-01' }, NOW)).toThrow(
      BadRequestException,
    );
  });

  it('refuses a date that does not exist', () => {
    expect(() =>
      resolveMoneyRange({ from: '2026-02-31', to: '2026-03-05' }, NOW),
    ).toThrow(BadRequestException);
  });

  it('allows 366 days and refuses 367', () => {
    // 2025-11-24 .. 2026-11-24 is 366 days inclusive.
    expect(
      resolveMoneyRange({ from: '2025-11-24', to: '2026-11-24' }, NOW).days,
    ).toBe(366);
    expect(() =>
      resolveMoneyRange({ from: '2025-11-23', to: '2026-11-24' }, NOW),
    ).toThrow(BadRequestException);
  });

  describe('the period before, to compare with', () => {
    it('is the equally long window that ends where a rolling one starts', () => {
      const r = resolveMoneyRange({ days: 7 }, NOW);
      expect(r.previous.until).toEqual(r.since);
      expect(r.previous.since).toEqual(new Date(r.since.getTime() - 7 * DAY));
    });

    it('is the same number of days right before a custom range', () => {
      const r = resolveMoneyRange(
        { from: '2026-11-01', to: '2026-11-10' },
        NOW,
      );
      expect(r.previous.since).toEqual(new Date('2026-10-22T00:00:00.000Z'));
      expect(r.previous.until).toEqual(new Date('2026-11-01T00:00:00.000Z'));
    });

    it('follows a "to" that was cut back to today', () => {
      const r = resolveMoneyRange(
        { from: '2026-11-20', to: '2026-12-31' },
        NOW,
      );
      // 5 days (20–24 Nov), so the 5 days before are 15–19 Nov
      expect(r.previous.since).toEqual(new Date('2026-11-15T00:00:00.000Z'));
      expect(r.previous.until).toEqual(new Date('2026-11-20T00:00:00.000Z'));
    });
  });
});
