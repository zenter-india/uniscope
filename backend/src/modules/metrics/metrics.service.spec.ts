import 'reflect-metadata';
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
  });
});
