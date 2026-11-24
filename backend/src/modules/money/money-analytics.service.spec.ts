import 'reflect-metadata';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { MoneyAnalyticsService } from './money-analytics.service';

describe('MoneyAnalyticsService', () => {
  const queryRaw = jest.fn<Promise<unknown>, [Prisma.Sql]>();
  const build = () =>
    new MoneyAnalyticsService({
      $queryRaw: queryRaw,
    } as unknown as PrismaService);
  const sqlOf = (call: number): Prisma.Sql => queryRaw.mock.calls[call][0];

  beforeEach(() => queryRaw.mockReset());

  describe('trend', () => {
    // three whole days: 1, 2 and 3 November
    const THREE_DAYS = { from: '2026-11-01', to: '2026-11-03' };

    it('has a bar for every day, quiet ones included, in order', async () => {
      queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const t = await build().trend(THREE_DAYS);
      expect(t.unit).toBe('day');
      expect(t.points.map((p) => p.bucket)).toEqual([
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
      ]);
      expect(t.points[0]).toEqual({
        bucket: '2026-11-01',
        topups: 0,
        paidMinor: 0,
        paidByPlatformMinor: { android: 0, ios: 0, web: 0 },
        uniminutes: { android: 0, ios: 0, web: 0 },
        mentorEarnedMinor: 0,
        calls: 0,
        minutes: 0,
      });
    });

    it('puts money in, by platform, on the day it happened', async () => {
      queryRaw
        .mockResolvedValueOnce([
          {
            bucket: '2026-11-02',
            platform: 'android',
            topups: 2,
            credited_minor: 30_000n, // BigInt, as Postgres sums come back
            paid_minor: 65_000n,
          },
          {
            bucket: '2026-11-02',
            platform: 'ios',
            topups: 1,
            credited_minor: 10_000n,
            paid_minor: 32_500n,
          },
        ])
        .mockResolvedValueOnce([]);
      const t = await build().trend(THREE_DAYS);
      expect(t.points[1]).toMatchObject({
        topups: 3,
        paidMinor: 97_500,
        paidByPlatformMinor: { android: 65_000, ios: 32_500, web: 0 },
        uniminutes: { android: 30, ios: 10, web: 0 },
      });
      expect(t.points[0].topups).toBe(0);
    });

    it('adds mentor earnings and billed calls and minutes', async () => {
      queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          bucket: '2026-11-03',
          earned_minor: 12_000n,
          calls: 2,
          debited_minor: 12_000n,
        },
      ]);
      const t = await build().trend(THREE_DAYS);
      expect(t.points[2]).toMatchObject({
        mentorEarnedMinor: 12_000,
        calls: 2,
        minutes: 12,
      });
    });

    it('ignores a row for a day outside the range or a platform it does not know', async () => {
      queryRaw
        .mockResolvedValueOnce([
          {
            bucket: '2025-01-01',
            platform: 'ios',
            topups: 9,
            credited_minor: 1n,
            paid_minor: 1n,
          },
          {
            bucket: '2026-11-01',
            platform: null,
            topups: 9,
            credited_minor: 1n,
            paid_minor: 1n,
          },
        ])
        .mockResolvedValueOnce([]);
      const t = await build().trend(THREE_DAYS);
      expect(t.points.every((p) => p.topups === 0)).toBe(true);
    });

    it('steps by week for a few months and by month for a year, on the right days', async () => {
      queryRaw.mockResolvedValue([]);
      const weeks = await build().trend({
        from: '2026-08-01',
        to: '2026-11-24',
      });
      expect(weeks.unit).toBe('week');
      expect(weeks.points[0].bucket).toBe('2026-07-27'); // the Monday of 1 Aug
      expect(weeks.points.at(-1)?.bucket).toBe('2026-11-23');
      const months = await build().trend({
        from: '2026-01-01',
        to: '2026-11-24',
      });
      expect(months.unit).toBe('month');
      expect(months.points).toHaveLength(11);
      expect(months.points[0].bucket).toBe('2026-01-01');
    });

    it('groups the database by the same step, and counts only calls', async () => {
      queryRaw.mockResolvedValue([]);
      await build().trend({ from: '2026-08-01', to: '2026-11-24' });
      expect(sqlOf(0).values).toContain('week');
      expect(sqlOf(0).sql).toContain('t.is_payment');
      expect(sqlOf(1).sql).toContain('session_id IS NOT NULL');
    });
  });

  describe('payers', () => {
    // numbers as measured on the real database
    const stats = {
      payers: 13,
      new_payers: 13,
      repeat_in_range: 4,
      topups: 21,
      credited_minor: 410_000n,
      paid_minor: 899_800n,
      payers_ever: 13,
      repeat_ever: 4,
      aspirants: 1537,
    };
    const packs = [
      { uniminutes: 10, platform: 'android', topups: 7, paid_minor: 175_000n },
      { uniminutes: 10, platform: 'ios', topups: 6, paid_minor: 195_000n },
      { uniminutes: 20, platform: 'android', topups: 3, paid_minor: 105_000n },
      { uniminutes: 20, platform: 'ios', topups: 1, paid_minor: 51_900n },
      { uniminutes: 40, platform: 'android', topups: 1, paid_minor: 75_000n },
      { uniminutes: 40, platform: 'ios', topups: 1, paid_minor: 97_900n },
      { uniminutes: 60, platform: 'android', topups: 2, paid_minor: 200_000n },
    ];
    const top = [
      {
        id: 'u1',
        display_name: 'Asha',
        unique_id: 'A112600001',
        topups: 5,
        credited_minor: 120_000n,
        paid_minor: 270_400n,
        platforms: 'android,ios',
        last_at: new Date('2026-11-21T10:01:00.420Z'),
      },
    ];
    const RANGE = { from: '2026-01-01', to: '2026-11-24' };

    const run = async (
      s: unknown[] = [stats],
      p: unknown[] = packs,
      t: unknown[] = top,
    ) => {
      queryRaw
        .mockResolvedValueOnce(s)
        .mockResolvedValueOnce(p)
        .mockResolvedValueOnce(t);
      return build().payers(RANGE);
    };

    it('says who paid, who was new and who came back', async () => {
      const { stats: s } = await run();
      expect(s).toMatchObject({
        payers: 13,
        newPayers: 13,
        returningPayers: 0,
        repeatInRange: 4,
        topups: 21,
        uniminutes: 410,
        paidMinor: 899_800,
        payersEver: 13,
        repeatEver: 4,
        aspirants: 1537,
      });
    });

    it('counts a payer who had already paid before the range as returning', async () => {
      const { stats: s } = await run([{ ...stats, payers: 5, new_payers: 2 }]);
      expect(s.newPayers).toBe(2);
      expect(s.returningPayers).toBe(3);
    });

    it('averages Uniminutes per top-up to one decimal', async () => {
      expect((await run()).stats.averageUniminutes).toBe(19.5); // 410 / 21
    });

    it('lists packs smallest first, with share and the split by platform', async () => {
      const { packs: p } = await run();
      expect(p.map((x) => x.uniminutes)).toEqual([10, 20, 40, 60]);
      expect(p[0]).toEqual({
        uniminutes: 10,
        count: 13,
        share: 13 / 21,
        paidMinor: 370_000,
        byPlatform: { android: 7, ios: 6, web: 0 },
      });
      expect(p.reduce((s, x) => s + x.count, 0)).toBe(21);
      expect(p.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10);
    });

    it('lists the biggest payers with their platforms and last top-up', async () => {
      const { topPayers } = await run();
      expect(topPayers).toEqual([
        {
          userId: 'u1',
          name: 'Asha',
          uniqueId: 'A112600001',
          topups: 5,
          uniminutes: 120,
          paidMinor: 270_400,
          platforms: ['android', 'ios'],
          lastAt: '2026-11-21T10:01:00.420Z',
        },
      ]);
    });

    it('is empty, not a divide-by-zero, with no payments', async () => {
      const r = await run([], [], []);
      expect(r.stats.payers).toBe(0);
      expect(r.stats.averageUniminutes).toBeNull();
      expect(r.packs).toEqual([]);
      expect(r.topPayers).toEqual([]);
    });

    it('reads real payments only, and Apple test-mode purchases are not among them', async () => {
      await run();
      for (const call of [0, 1, 2]) {
        expect(sqlOf(call).sql).toContain('is_payment');
        expect(sqlOf(call).sql).toContain("<> 'Sandbox'");
      }
    });

    it('measures "ever paid" against active aspirant accounts', async () => {
      await run();
      expect(sqlOf(0).sql).toContain("role = 'ASPIRANT' AND is_active");
    });
  });

  describe('balances', () => {
    const NOW = new Date('2026-11-24T12:00:00.000Z');
    // as measured on the real database
    const kinds = [
      { role: 'ASPIRANT', kind: 'PAYOUT', entries: 1, sum_minor: -20_000n },
      { role: 'ASPIRANT', kind: 'BOUGHT', entries: 21, sum_minor: 410_000n },
      { role: 'MENTOR', kind: 'TEST_CREDIT', entries: 1, sum_minor: 100_000n },
      { role: 'MENTOR', kind: 'PAYOUT', entries: 7, sum_minor: -277_000n },
      {
        role: 'MENTOR',
        kind: 'SESSION_CREDIT',
        entries: 58,
        sum_minor: 371_000n,
      },
      { role: 'MENTOR', kind: 'ADJUSTMENT', entries: 1, sum_minor: 300n },
      { role: 'ASPIRANT', kind: 'TEST_CREDIT', entries: 3, sum_minor: 80_000n },
      {
        role: 'ASPIRANT',
        kind: 'SESSION_DEBIT',
        entries: 59,
        sum_minor: -376_000n,
      },
      {
        role: 'ASPIRANT',
        kind: 'MANUAL_EARNINGS',
        entries: 1,
        sum_minor: 20_000n,
      },
      {
        role: 'ASPIRANT',
        kind: 'ADJUSTMENT',
        entries: 21,
        sum_minor: 2_811_000n,
      },
    ];
    const wallets = [
      { role: 'ASPIRANT', wallets: 24, balance_minor: 3_070_000n },
      { role: 'MENTOR', wallets: 8, balance_minor: 194_300n },
    ];
    const owed = [
      {
        id: 'm1',
        display_name: 'Dr Rao',
        unique_id: 'M11260000004',
        balance_minor: 54_000,
        last_payout_at: null,
        owed_since: new Date('2026-09-04T09:48:05.575Z'),
      },
      {
        id: 'm2',
        display_name: 'Dr Khan',
        unique_id: null,
        balance_minor: 68_000,
        last_payout_at: new Date('2026-09-08T18:35:03.882Z'),
        owed_since: null,
      },
    ];

    const run = async (
      k: unknown[] = kinds,
      w: unknown[] = wallets,
      o: unknown[] = owed,
    ) => {
      queryRaw
        .mockResolvedValueOnce(k)
        .mockResolvedValueOnce(w)
        .mockResolvedValueOnce(o);
      return build().balances(NOW);
    };

    it('shows where a balance came from, biggest first', async () => {
      const { aspirants } = await run();
      expect(aspirants.wallets).toBe(24);
      expect(aspirants.balanceMinor).toBe(3_070_000);
      expect(aspirants.lines.map((l) => l.kind)).toEqual([
        'ADJUSTMENT',
        'BOUGHT',
        'SESSION_DEBIT',
        'TEST_CREDIT',
        'PAYOUT',
        'MANUAL_EARNINGS',
      ]);
      expect(aspirants.lines[0]).toEqual({
        kind: 'ADJUSTMENT',
        entries: 21,
        minor: 2_811_000,
      });
    });

    it('says how much of a balance the ledger cannot explain', async () => {
      // Real data: two aspirant wallets hold 145 Uniminutes with no ledger
      // entries at all (their balance was set outside the ledger).
      const { aspirants, mentors } = await run();
      expect(aspirants.unexplainedMinor).toBe(145_000);
      expect(mentors.balanceMinor).toBe(194_300);
      expect(mentors.unexplainedMinor).toBe(0);
    });

    it('shows no gap when the ledger explains the balance fully', async () => {
      const { mentors } = await run();
      expect(mentors.lines.reduce((s, l) => s + l.minor, 0)).toBe(
        mentors.balanceMinor,
      );
    });

    it('lists the mentors who are owed, and for how long', async () => {
      const { owedMentors } = await run();
      expect(owedMentors[0]).toEqual({
        id: 'm1',
        name: 'Dr Rao',
        uniqueId: 'M11260000004',
        balanceMinor: 54_000,
        lastPayoutAt: null,
        owedSince: '2026-09-04T09:48:05.575Z',
        daysOwed: 81,
      });
    });

    it('has no "owed since" when no earning came after the last payout', async () => {
      const { owedMentors } = await run();
      expect(owedMentors[1]).toMatchObject({
        owedSince: null,
        daysOwed: null,
        lastPayoutAt: '2026-09-08T18:35:03.882Z',
      });
    });

    it('is empty, not a crash, on an empty ledger', async () => {
      const b = await run([], [], []);
      expect(b.aspirants).toEqual({
        wallets: 0,
        balanceMinor: 0,
        lines: [],
        unexplainedMinor: 0,
      });
      expect(b.owedMentors).toEqual([]);
    });

    it('splits test credits and real purchases, and manual earnings from call earnings', async () => {
      await run();
      const sql = sqlOf(0).sql;
      expect(sql).toContain("'BOUGHT'");
      expect(sql).toContain("'TEST_CREDIT'");
      expect(sql).toContain("'MANUAL_EARNINGS'");
    });
  });

  describe('usage', () => {
    const RANGE = { from: '2026-01-01', to: '2026-11-24' };
    // as measured on the real database
    const outcomes = [
      {
        outcome: 'billed',
        sessions: 54,
        billed_minutes: 392n,
        cost_minor: 368_000n,
      },
      { outcome: 'declined', sessions: 19, billed_minutes: 0n, cost_minor: 0n },
      { outcome: 'open', sessions: 7, billed_minutes: 0n, cost_minor: 0n },
      {
        outcome: 'mentor_no_show',
        sessions: 2,
        billed_minutes: 0n,
        cost_minor: 0n,
      },
      {
        outcome: 'not_connected',
        sessions: 98,
        billed_minutes: 0n,
        cost_minor: 0n,
      },
      {
        outcome: 'aspirant_no_show',
        sessions: 1,
        billed_minutes: 0n,
        cost_minor: 3_000n,
      },
      {
        outcome: 'cancelled',
        sessions: 55,
        billed_minutes: 0n,
        cost_minor: 0n,
      },
    ];

    const run = async (
      o: unknown[] = outcomes,
      p: unknown[] = [{ callers: 23, mentors_called: 10 }],
    ) => {
      queryRaw.mockResolvedValueOnce(o).mockResolvedValueOnce(p);
      return build().usage(RANGE);
    };

    it('totals the requests and the billed calls', async () => {
      const u = await run();
      expect(u).toMatchObject({
        requested: 236,
        billedCalls: 54,
        billedMinutes: 392,
        billedCostMinor: 368_000,
        callers: 23,
        mentorsCalled: 10,
      });
    });

    it('gives the average billed minutes and the share that ended in a billed call', async () => {
      const u = await run();
      expect(u.averageBilledMinutes).toBe(7.3); // 392 / 54
      expect(u.billedShare).toBeCloseTo(54 / 236, 10);
    });

    it('always lists every outcome in a fixed order, zeros included', async () => {
      const u = await run([outcomes[0]]);
      expect(u.outcomes.map((o) => o.outcome)).toEqual([
        'billed',
        'declined',
        'cancelled',
        'aspirant_no_show',
        'mentor_no_show',
        'not_connected',
        'open',
      ]);
      expect(u.outcomes.find((o) => o.outcome === 'declined')).toEqual({
        outcome: 'declined',
        count: 0,
        minutes: 0,
        costMinor: 0,
      });
    });

    it('keeps the no-show fee on the aspirant no-show line', async () => {
      const u = await run();
      expect(u.outcomes.find((o) => o.outcome === 'aspirant_no_show')).toEqual({
        outcome: 'aspirant_no_show',
        count: 1,
        minutes: 0,
        costMinor: 3_000,
      });
    });

    it('is empty, not a divide-by-zero, when nobody called', async () => {
      const u = await run([], []);
      expect(u.requested).toBe(0);
      expect(u.averageBilledMinutes).toBeNull();
      expect(u.billedShare).toBeNull();
      expect(u.callers).toBe(0);
    });

    it('looks only at call requests in the picked days', async () => {
      await run();
      expect(sqlOf(0).sql).toContain("s.type = 'AUDIO_CALL'");
      expect(sqlOf(0).values).toEqual(
        expect.arrayContaining([
          new Date('2026-01-01T00:00:00.000Z'),
          new Date('2026-11-25T00:00:00.000Z'),
        ]),
      );
    });
  });
});
