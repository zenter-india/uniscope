/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return --
 * This spec inspects the arguments a jest mock was called with (Prisma
 * where/orderBy trees). jest types those as `any`; typing every nested level
 * would only restate the shape the assertions already check. */
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PrismaService } from '../../database/prisma/prisma.service.js';
import { MetricsQueryDto } from './dto/metrics-query.dto.js';
import { MetricsService } from './metrics.service.js';

function prismaWithNewUsers(count: number) {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
  const users = Array.from({ length: count }, (_, i) => ({
    createdAt: hoursAgo(i + 1),
    role: 'ASPIRANT',
  }));
  return {
    user: {
      findMany: jest.fn().mockResolvedValue(users),
      count: jest.fn().mockResolvedValue(0),
    },
    session: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    ledgerEntry: { groupBy: jest.fn().mockResolvedValue([]) },
    payoutRequest: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountMinor: null } }),
      count: jest.fn().mockResolvedValue(0),
    },
    university: { count: jest.fn().mockResolvedValue(0) },
    enrollmentLead: { count: jest.fn().mockResolvedValue(0) },
    report: { count: jest.fn().mockResolvedValue(0) },
  } as unknown as PrismaService;
}

describe('MetricsQueryDto', () => {
  const check = (days: string) =>
    validate(plainToInstance(MetricsQueryDto, { days }));

  it.each(['1', '7', '30', '90'])('accepts days=%s', async (days) => {
    expect(await check(days)).toHaveLength(0);
  });

  it.each(['0', '2', '365'])('rejects days=%s', async (days) => {
    expect((await check(days)).length).toBeGreaterThan(0);
  });
});

describe('MetricsService.getOverview', () => {
  it('counts the rolling last 24 hours for days=1 and omits the per-day series', async () => {
    const service = new MetricsService(prismaWithNewUsers(3));
    const m = await service.getOverview(1);
    expect(m.rangeDays).toBe(1);
    expect(m.signups.total).toBe(3);
    expect(m.signups.series).toEqual([]);
    expect(m.sessions.series).toEqual([]);
  });

  it('still returns one series bucket per day for longer ranges', async () => {
    const service = new MetricsService(prismaWithNewUsers(2));
    const m = await service.getOverview(7);
    expect(m.signups.series).toHaveLength(7);
    expect(m.sessions.series).toHaveLength(7);
    expect(m.range).toBeNull();
  });

  it('compares money with the previous window of the same length', async () => {
    const prisma = prismaWithNewUsers(0);
    (prisma.ledgerEntry.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { type: 'TOPUP', _sum: { amountMinor: 50000 } },
        { type: 'REFUND', _sum: { amountMinor: -2000 } },
      ])
      .mockResolvedValueOnce([
        { type: 'TOPUP', _sum: { amountMinor: 20000 } },
        { type: 'PAYOUT', _sum: { amountMinor: -7000 } },
      ]);
    const m = await new MetricsService(prisma).getOverview(1);

    expect(m.revenue.topupMinor).toBe(50000);
    expect(m.revenue.refundsMinor).toBe(2000);
    expect(m.revenue.previous.topupMinor).toBe(20000);
    expect(m.revenue.previous.payoutsPaidMinor).toBe(7000);
    // The two ledger reads cover consecutive windows: previous ends where
    // the current one starts.
    const [now, prev] = (
      prisma.ledgerEntry.groupBy as jest.Mock
    ).mock.calls.map((c) => c[0].where.createdAt);
    expect(prev.lt.getTime()).toBe(now.gte.getTime());
  });
});

describe('MetricsQueryDto custom range', () => {
  const check = (from: string, to: string) =>
    validate(plainToInstance(MetricsQueryDto, { from, to }));

  it('accepts YYYY-MM-DD dates', async () => {
    expect(await check('2026-11-01', '2026-11-07')).toHaveLength(0);
  });

  it.each([
    ['yesterday', '2026-11-07'],
    ['2026-11-01', '07/11/2026'],
  ])('rejects %s .. %s', async (from, to) => {
    expect((await check(from, to)).length).toBeGreaterThan(0);
  });
});

describe('MetricsService.getOverviewForDates', () => {
  const daysAgo = (n: number) =>
    new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

  it('builds a window of whole UTC days, both ends included', async () => {
    const prisma = prismaWithNewUsers(0);
    const from = daysAgo(9);
    const to = daysAgo(3);
    const m = await new MetricsService(prisma).getOverviewForDates(from, to);

    expect(m.rangeDays).toBe(7);
    expect(m.range).toEqual({ from, to });
    expect(m.signups.series.map((b) => b.date)[0]).toBe(from);
    expect(m.signups.series).toHaveLength(7);

    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.createdAt.gte.toISOString()).toBe(`${from}T00:00:00.000Z`);
    // Exclusive end = midnight after the last picked day.
    expect(where.createdAt.lt.getTime() - where.createdAt.gte.getTime()).toBe(
      7 * 86_400_000,
    );
  });

  it('compares with the same number of days right before the range', async () => {
    const prisma = prismaWithNewUsers(0);
    const from = daysAgo(9);
    await new MetricsService(prisma).getOverviewForDates(from, daysAgo(3));

    const prevCall = (prisma.user.count as jest.Mock).mock.calls.find(
      (c) => c[0]?.where?.createdAt?.gte,
    )![0].where.createdAt;
    expect(prevCall.lt.toISOString()).toBe(`${from}T00:00:00.000Z`);
    expect(prevCall.lt.getTime() - prevCall.gte.getTime()).toBe(7 * 86_400_000);
  });

  it('treats a single day as a window with no per-day chart', async () => {
    const day = daysAgo(2);
    const m = await new MetricsService(
      prismaWithNewUsers(0),
    ).getOverviewForDates(day, day);
    expect(m.rangeDays).toBe(1);
    expect(m.range).toEqual({ from: day, to: day });
    expect(m.signups.series).toEqual([]);
  });

  it('cuts a "to" in the future back to today', async () => {
    const m = await new MetricsService(
      prismaWithNewUsers(0),
    ).getOverviewForDates(daysAgo(2), daysAgo(-5));
    expect(m.range!.to).toBe(daysAgo(0));
    expect(m.rangeDays).toBe(3);
  });

  it.each([
    ['not a real date', '2026-02-31', '2026-03-05'],
    ['to before from', daysAgo(1), daysAgo(5)],
    ['starts in the future', daysAgo(-2), daysAgo(-4)],
    ['longer than a year', daysAgo(400), daysAgo(1)],
  ])('rejects %s', async (_label, from, to) => {
    await expect(
      new MetricsService(prismaWithNewUsers(0)).getOverviewForDates(from, to),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
