import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { CSV_BOM } from './money-csv';
import { MoneyService } from './money.service';

const RANGE = { from: '2026-11-01', to: '2026-11-10' };

describe('MoneyService', () => {
  const queryRaw = jest.fn<Promise<unknown>, [Prisma.Sql]>();
  const build = () =>
    new MoneyService({ $queryRaw: queryRaw } as unknown as PrismaService);
  /** The Prisma.Sql a given call was made with. */
  const sqlOf = (call: number): Prisma.Sql => queryRaw.mock.calls[call][0];

  beforeEach(() => queryRaw.mockReset());

  describe('summary', () => {
    const topups: {
      platform: string | null;
      topups: number;
      users: number;
      credited_minor: bigint;
      paid_minor: bigint;
      paid_known: number;
    }[] = [
      {
        platform: 'android',
        topups: 3,
        users: 2,
        credited_minor: 50_000n, // BigInt, as Postgres sums come back
        paid_minor: 75_000n,
        paid_known: 3,
      },
      {
        platform: 'ios',
        topups: 2,
        users: 2,
        credited_minor: 50_000n,
        paid_minor: 0n,
        paid_known: 0,
      },
    ];
    const flows = [
      {
        type: 'SESSION_CREDIT',
        entries: 5,
        wallets: 2,
        sessions: 4,
        sum_minor: 30_000n,
        credits_minor: 30_000n,
        debits_minor: 0n,
      },
      {
        type: 'PAYOUT',
        entries: 1,
        wallets: 1,
        sessions: 0,
        sum_minor: -10_000n,
        credits_minor: 0n,
        debits_minor: -10_000n,
      },
      {
        type: 'REFUND',
        entries: 1,
        wallets: 1,
        sessions: 1,
        sum_minor: 2_000n,
        credits_minor: 2_000n,
        debits_minor: 0n,
      },
      {
        type: 'ADJUSTMENT',
        entries: 3,
        wallets: 2,
        sessions: 0,
        sum_minor: 4_000n,
        credits_minor: 5_000n,
        debits_minor: -1_000n,
      },
    ];
    const owed = [{ owed_minor: 15_000n, mentors: 2 }];

    const run = async (t = topups, f = flows, o = owed) => {
      queryRaw
        .mockResolvedValueOnce(t)
        .mockResolvedValueOnce(f)
        .mockResolvedValueOnce(o);
      return build().summary(RANGE);
    };

    it('always lists the three platforms, in a fixed order, with zeros where nothing happened', async () => {
      const s = await run();
      expect(s.topups.byPlatform.map((p) => p.platform)).toEqual([
        'android',
        'ios',
        'web',
      ]);
      expect(s.topups.byPlatform[2]).toEqual({
        platform: 'web',
        count: 0,
        users: 0,
        uniminutes: 0,
        paidMinor: 0,
        paidKnown: 0,
      });
    });

    it('turns database sums into plain numbers per platform', async () => {
      const [android, ios] = (await run()).topups.byPlatform;
      expect(android).toEqual({
        platform: 'android',
        count: 3,
        users: 2,
        uniminutes: 50, // 50 000 minor = 50 Uniminutes
        paidMinor: 75_000,
        paidKnown: 3,
      });
      // An Apple purchase records no rupee price: paid stays unknown.
      expect(ios).toMatchObject({ count: 2, uniminutes: 50, paidKnown: 0 });
    });

    it('totals the platforms', async () => {
      const s = await run();
      expect(s.topups).toMatchObject({
        count: 5,
        uniminutes: 100,
        paidMinor: 75_000,
      });
    });

    it('reports mentor earnings, payouts and refunds as positive amounts', async () => {
      const s = await run();
      expect(s.mentorEarnings).toEqual({
        earnedMinor: 30_000,
        sessions: 4,
        mentors: 2,
      });
      expect(s.payoutsPaidMinor).toBe(10_000);
      expect(s.refundsMinor).toBe(2_000);
    });

    it('keeps admin adjustments on their own line, debits as a positive number', async () => {
      const s = await run();
      expect(s.adjustments).toEqual({
        count: 3,
        creditsMinor: 5_000,
        debitsMinor: 1_000,
      });
    });

    it('says what mentors hold right now, whatever the range', async () => {
      const s = await run();
      expect(s.mentorBalanceMinor).toBe(15_000);
      expect(s.mentorsOwed).toBe(2);
    });

    it('keeps test and manual credits out of "money in" and counts them on their own line', async () => {
      // Real data has two: a developer test row and a "manual test credit".
      const s = await run([
        ...topups,
        {
          platform: null,
          topups: 2,
          users: 2,
          credited_minor: 150_000n,
          paid_minor: 0n,
          paid_known: 0,
        },
      ]);
      expect(s.topups.byPlatform.map((p) => p.platform)).toEqual([
        'android',
        'ios',
        'web',
      ]);
      expect(s.topups.notPayments).toEqual({ count: 2, uniminutes: 150 });
      // the totals are still only the real payments
      expect(s.topups).toMatchObject({
        count: 5,
        uniminutes: 100,
        paidMinor: 75_000,
      });
    });

    it('has nothing on the not-a-payment line when every top-up was a payment', async () => {
      expect((await run()).topups.notPayments).toEqual({
        count: 0,
        uniminutes: 0,
      });
    });

    it('is all zeros on an empty ledger', async () => {
      const s = await run([], [], []);
      expect(s.topups.count).toBe(0);
      expect(s.topups.notPayments.count).toBe(0);
      expect(s.mentorEarnings.earnedMinor).toBe(0);
      expect(s.payoutsPaidMinor).toBe(0);
      expect(s.mentorBalanceMinor).toBe(0);
    });

    it('asks every query for the same days, and echoes the range', async () => {
      const s = await run();
      expect(s.range).toEqual(RANGE);
      const since = new Date('2026-11-01T00:00:00.000Z');
      const until = new Date('2026-11-11T00:00:00.000Z');
      for (const call of [0, 1]) {
        expect(sqlOf(call).values).toEqual(
          expect.arrayContaining([since, until]),
        );
      }
    });

    it('classifies by the iOS price tiers, read from the price list', async () => {
      await run();
      expect(sqlOf(0).values).toEqual(
        expect.arrayContaining([32_500, 52_000, 97_500, 130_000]),
      );
    });
  });

  describe('listTopups', () => {
    const row = (n: number, over: Record<string, unknown> = {}) => ({
      id: `entry-${n}`,
      created_at: new Date(`2026-11-0${n}T10:00:00.000Z`),
      cursor_ts: `2026-11-0${n}T10:00:00.000123Z`,
      amount_minor: 10_000,
      platform: 'android',
      paid_minor: 25_000,
      user_id: `user-${n}`,
      display_name: `Asha ${n}`,
      unique_id: `A11260000${n}`,
      role: 'ASPIRANT',
      ...over,
    });

    it('returns one page and a cursor when there is more', async () => {
      queryRaw.mockResolvedValue([row(3), row(2), row(1)]);
      const res = await build().listTopups({ ...RANGE, limit: 2 });
      expect(res.data.map((t) => t.id)).toEqual(['entry-3', 'entry-2']);
      expect(res.nextCursor).not.toBeNull();
      // asked for one extra row to know there is a next page
      expect(sqlOf(0).values).toContain(3);
    });

    it('has no cursor on the last page', async () => {
      queryRaw.mockResolvedValue([row(2), row(1)]);
      const res = await build().listTopups({ ...RANGE, limit: 5 });
      expect(res.data).toHaveLength(2);
      expect(res.nextCursor).toBeNull();
    });

    it('maps a row: Uniminutes from the credit, price in paise, platform', async () => {
      queryRaw.mockResolvedValue([row(1)]);
      const [t] = (await build().listTopups(RANGE)).data;
      expect(t).toEqual({
        id: 'entry-1',
        createdAt: '2026-11-01T10:00:00.000Z',
        userId: 'user-1',
        userName: 'Asha 1',
        uniqueId: 'A112600001',
        role: 'ASPIRANT',
        platform: 'android',
        uniminutes: 10,
        paidMinor: 25_000,
      });
    });

    it('shows no price for an Apple purchase, and no platform it cannot tell', async () => {
      queryRaw.mockResolvedValue([
        row(1, { platform: 'ios', paid_minor: null }),
        row(2, { platform: null, paid_minor: null }),
      ]);
      const { data } = await build().listTopups(RANGE);
      expect(data[0]).toMatchObject({ platform: 'ios', paidMinor: null });
      expect(data[1].platform).toBeNull();
    });

    it('carries the platform filter and the search text to the query', async () => {
      queryRaw.mockResolvedValue([]);
      await build().listTopups({ ...RANGE, platform: 'ios', q: 'asha' });
      const values = sqlOf(0).values;
      expect(values).toContain('ios');
      // once for the alias test, once for the ID-prefix test
      expect(values.filter((v) => v === 'asha')).toHaveLength(2);
    });

    it('lists real payments only, never test or manual credits', async () => {
      queryRaw.mockResolvedValue([]);
      await build().listTopups(RANGE);
      const sql = sqlOf(0).sql;
      expect(sql).toContain("LIKE 'apple-iap:%'");
      expect(sql).toContain("LIKE 'razorpay:%'");
      expect(sql).toContain('le.platform IS NOT NULL');
    });

    it('does not filter when none is asked for', async () => {
      queryRaw.mockResolvedValue([]);
      await build().listTopups(RANGE);
      const values = sqlOf(0).values;
      expect(values).not.toContain('ios');
      expect(values).not.toContain('android');
    });

    it('continues after the cursor it handed out', async () => {
      queryRaw.mockResolvedValue([row(3), row(2), row(1)]);
      const first = await build().listTopups({ ...RANGE, limit: 2 });
      queryRaw.mockResolvedValue([row(1)]);
      await build().listTopups({
        ...RANGE,
        limit: 2,
        cursor: first.nextCursor!,
      });
      // the second call is bounded by the last row of the first page
      expect(sqlOf(1).values).toEqual(
        expect.arrayContaining(['2026-11-02T10:00:00.000123Z', 'entry-2']),
      );
    });

    it.each([
      'not-base64-json',
      Buffer.from('{"t":"yesterday","id":"x"}').toString('base64url'),
      Buffer.from('{"t":"2026-11-02T10:00:00.000123Z"}').toString('base64url'),
      Buffer.from('[]').toString('base64url'),
    ])('refuses a page link that is not one of ours: %s', async (cursor) => {
      await expect(
        build().listTopups({ ...RANGE, cursor }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('mentors', () => {
    const mrow = (n: number, over: Record<string, unknown> = {}) => ({
      id: `m-${n}`,
      display_name: `Mentor ${n}`,
      unique_id: `M11260000${n}`,
      earned_minor: 60_000n,
      sessions: 7,
      paid_out_minor: 20_000n,
      balance_minor: 40_000,
      ...over,
    });

    it('maps earnings into calls, minutes and paise', async () => {
      queryRaw.mockResolvedValue([mrow(1)]);
      const { data, truncated } = await build().mentors(RANGE);
      expect(truncated).toBe(false);
      expect(data[0]).toEqual({
        id: 'm-1',
        name: 'Mentor 1',
        uniqueId: 'M112600001',
        sessions: 7,
        minutes: 60, // 60 000 minor = 60 Uniminutes = 60 minutes
        earnedMinor: 60_000,
        paidOutMinor: 20_000,
        balanceMinor: 40_000,
      });
    });

    it('says when the list was cut short', async () => {
      queryRaw.mockResolvedValue(
        Array.from({ length: 1001 }, (_, i) => mrow(i)),
      );
      const res = await build().mentors(RANGE);
      expect(res.data).toHaveLength(1000);
      expect(res.truncated).toBe(true);
    });
  });

  describe('CSV exports', () => {
    it('exports top-ups with a readable header, rupees, and blanks where unknown', async () => {
      queryRaw.mockResolvedValue([
        {
          id: 'e1',
          created_at: new Date('2026-11-01T10:00:00.000Z'),
          cursor_ts: '2026-11-01T10:00:00.000000Z',
          amount_minor: 10_000,
          platform: 'ios',
          paid_minor: null,
          user_id: 'u1',
          display_name: '=HYPERLINK("x")',
          unique_id: 'A112600001',
          role: 'ASPIRANT',
        },
        {
          id: 'e2',
          created_at: new Date('2026-11-02T10:00:00.000Z'),
          cursor_ts: '2026-11-02T10:00:00.000000Z',
          amount_minor: 20_000,
          platform: 'android',
          paid_minor: 40_000,
          user_id: 'u2',
          display_name: 'Ravi',
          unique_id: null,
          role: 'ASPIRANT',
        },
      ]);
      const csv = await build().exportTopupsCsv(RANGE);
      const lines = csv.replace(CSV_BOM, '').split('\n');
      expect(lines[0]).toBe(
        '"Date (UTC)","User","User ID","Role","Platform","Uniminutes credited","Paid (INR)"',
      );
      // a name that looks like a formula is neutralised; iOS price is blank
      expect(lines[1]).toBe(
        `"2026-11-01T10:00:00.000Z","'=HYPERLINK(""x"")","A112600001","ASPIRANT","ios",10,`,
      );
      expect(lines[2]).toBe(
        '"2026-11-02T10:00:00.000Z","Ravi",,"ASPIRANT","android",20,400',
      );
    });

    it('does not use a cursor for an export', async () => {
      queryRaw.mockResolvedValue([]);
      await build().exportTopupsCsv({ ...RANGE, cursor: 'ignored' });
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('exports mentor earnings in rupees', async () => {
      queryRaw.mockResolvedValue([
        {
          id: 'm1',
          display_name: 'Dr Priya',
          unique_id: 'M112600001',
          earned_minor: 391_000n,
          sessions: 12,
          paid_out_minor: 297_000n,
          balance_minor: 94_000,
        },
      ]);
      const csv = await build().exportMentorsCsv(RANGE);
      const lines = csv.replace(CSV_BOM, '').split('\n');
      expect(lines[0]).toBe(
        '"Mentor","User ID","Calls","Minutes","Earned (INR)","Paid out (INR)","Balance now (INR)"',
      );
      expect(lines[1]).toBe('"Dr Priya","M112600001",12,391,3910,2970,940');
    });
  });
});
