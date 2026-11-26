import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { CSV_BOM } from './money-csv';
import { MoneyService, mentorStats, type MoneyMentor } from './money.service';

const RANGE = { from: '2026-11-01', to: '2026-11-10' };

describe('MoneyService', () => {
  const queryRaw = jest.fn<Promise<unknown>, [Prisma.Sql]>();
  const build = () =>
    new MoneyService({ $queryRaw: queryRaw } as unknown as PrismaService);
  /** The Prisma.Sql a given call was made with. */
  const sqlOf = (call: number): Prisma.Sql => queryRaw.mock.calls[call][0];

  beforeEach(() => queryRaw.mockReset());

  describe('summary', () => {
    const agg = (over: Record<string, unknown>) => ({
      is_payment: true,
      platform: 'android',
      topups: 0,
      users: 0,
      credited_minor: 0n,
      paid_minor: 0n,
      paid_known: 0,
      ...over,
    });
    const topups = [
      agg({
        platform: 'android',
        topups: 3,
        users: 2,
        credited_minor: 50_000n, // BigInt, as Postgres sums come back
        paid_minor: 75_000n,
        paid_known: 3,
      }),
      agg({
        platform: 'ios',
        topups: 2,
        users: 2,
        credited_minor: 50_000n,
        paid_minor: 51_900n, // Apple sends the price: ₹325 + ₹194
        paid_known: 2,
      }),
    ];
    const flow = (over: Record<string, unknown>) => ({
      type: 'SESSION_CREDIT',
      no_session: false,
      entries: 0,
      wallets: 0,
      sessions: 0,
      sum_minor: 0n,
      credits_minor: 0n,
      debits_minor: 0n,
      ...over,
    });
    const flows = [
      flow({
        type: 'SESSION_CREDIT',
        entries: 5,
        wallets: 2,
        sessions: 4,
        sum_minor: 30_000n,
        credits_minor: 30_000n,
      }),
      flow({
        type: 'PAYOUT',
        no_session: true,
        entries: 1,
        wallets: 1,
        sum_minor: -10_000n,
        debits_minor: -10_000n,
      }),
      flow({
        type: 'REFUND',
        no_session: true,
        entries: 1,
        wallets: 1,
        sessions: 1,
        sum_minor: 2_000n,
        credits_minor: 2_000n,
      }),
      flow({
        type: 'ADJUSTMENT',
        no_session: true,
        entries: 3,
        wallets: 2,
        sum_minor: 4_000n,
        credits_minor: 5_000n,
        debits_minor: -1_000n,
      }),
    ];
    const owed = [{ owed_minor: 15_000n, mentors: 2 }];

    /** Calls run in this order: this period's top-ups and flows, the previous
     * period's top-ups and flows, then what mentors hold. */
    const run = async (
      t: unknown[] = topups,
      f: unknown[] = flows,
      o: unknown[] = owed,
      prevT: unknown[] = [],
      prevF: unknown[] = [],
    ) => {
      queryRaw
        .mockResolvedValueOnce(t)
        .mockResolvedValueOnce(f)
        .mockResolvedValueOnce(prevT)
        .mockResolvedValueOnce(prevF)
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
      // The price Apple sent counts: iOS rupees are known, not left blank.
      expect(ios).toEqual({
        platform: 'ios',
        count: 2,
        users: 2,
        uniminutes: 50,
        paidMinor: 51_900,
        paidKnown: 2,
      });
    });

    it('totals the platforms', async () => {
      const s = await run();
      expect(s.topups).toMatchObject({
        count: 5,
        uniminutes: 100,
        paidMinor: 126_900,
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

    it('keeps a mentor credit with no call behind it out of earnings', async () => {
      // Real data has one: "Manual test earnings credit … (not a real session)".
      const s = await run(topups, [
        ...flows,
        flow({
          type: 'SESSION_CREDIT',
          no_session: true,
          entries: 1,
          wallets: 1,
          sum_minor: 20_000n,
          credits_minor: 20_000n,
        }),
      ]);
      expect(s.mentorEarnings.earnedMinor).toBe(30_000);
      expect(s.manualEarnings).toEqual({ count: 1, minor: 20_000 });
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

    it('keeps test, Apple test-mode and refunded credits out of "money in", on their own line', async () => {
      // Real data: a developer test row and a manual credit (no platform), and
      // two Apple "Sandbox" purchases (an iOS platform, but not real money).
      const s = await run([
        ...topups,
        agg({
          is_payment: false,
          platform: null,
          topups: 2,
          users: 2,
          credited_minor: 150_000n,
        }),
        agg({
          is_payment: false,
          platform: 'ios',
          topups: 2,
          users: 1,
          credited_minor: 30_000n,
          paid_minor: 84_400n,
          paid_known: 2,
        }),
      ]);
      expect(s.topups.notPayments).toEqual({ count: 4, uniminutes: 180 });
      // iOS is untouched by the Sandbox purchases, and so are the totals
      expect(s.topups.byPlatform[1]).toMatchObject({
        count: 2,
        uniminutes: 50,
        paidMinor: 51_900,
      });
      expect(s.topups).toMatchObject({ count: 5, uniminutes: 100 });
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
      expect(s.manualEarnings.count).toBe(0);
      expect(s.payoutsPaidMinor).toBe(0);
      expect(s.mentorBalanceMinor).toBe(0);
    });

    it('carries the period before, for the comparison', async () => {
      const s = await run(
        topups,
        flows,
        owed,
        [
          agg({
            platform: 'android',
            topups: 1,
            users: 1,
            credited_minor: 10_000n,
            paid_minor: 25_000n,
            paid_known: 1,
          }),
          agg({
            is_payment: false,
            platform: null,
            topups: 1,
            credited_minor: 99_000n,
          }),
        ],
        [
          flow({ type: 'SESSION_CREDIT', sessions: 1, sum_minor: 6_000n }),
          flow({ type: 'PAYOUT', no_session: true, sum_minor: -3_000n }),
        ],
      );
      expect(s.previous).toEqual({
        topups: { count: 1, uniminutes: 10, paidMinor: 25_000 },
        mentorEarnedMinor: 6_000,
        payoutsPaidMinor: 3_000,
      });
    });

    it('asks this period for the picked days and the previous one for the days before', async () => {
      const s = await run();
      expect(s.range).toEqual(RANGE);
      const since = new Date('2026-11-01T00:00:00.000Z');
      const until = new Date('2026-11-11T00:00:00.000Z');
      for (const call of [0, 1]) {
        expect(sqlOf(call).values).toEqual(
          expect.arrayContaining([since, until]),
        );
      }
      // 10 days: the 10 days right before are 22 Oct – 31 Oct
      const prevSince = new Date('2026-10-22T00:00:00.000Z');
      for (const call of [2, 3]) {
        expect(sqlOf(call).values).toEqual(
          expect.arrayContaining([prevSince, since]),
        );
      }
    });

    it('classifies by the iOS price tiers, read from the price list', async () => {
      await run();
      expect(sqlOf(0).values).toEqual(
        expect.arrayContaining([32_500, 52_000, 97_500, 130_000]),
      );
    });

    it("reads Apple's own price, and drops test-mode and refunded purchases", async () => {
      await run();
      const sql = sqlOf(0).sql;
      expect(sql).toContain("raw_payload->>'price'");
      expect(sql).toContain("raw_payload->>'currency' = 'INR'");
      expect(sql).toContain("<> 'Sandbox'");
      expect(sql).toContain("= 'CREDITED'");
    });

    it('counts only calls as earnings (session_id set)', async () => {
      await run();
      expect(sqlOf(1).sql).toContain('(le.session_id IS NULL) AS no_session');
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

    it('shows the price Apple sent for an iOS purchase, and no price only when it is unknown', async () => {
      queryRaw.mockResolvedValue([
        row(1, { platform: 'ios', paid_minor: 32_500 }),
        row(2, { platform: 'ios', paid_minor: null }),
        row(3, { platform: null, paid_minor: null }),
      ]);
      const { data } = await build().listTopups(RANGE);
      expect(data[0]).toMatchObject({ platform: 'ios', paidMinor: 32_500 });
      expect(data[1]).toMatchObject({ platform: 'ios', paidMinor: null });
      expect(data[2].platform).toBeNull();
    });

    it('carries the platform filter and the search text to the query', async () => {
      queryRaw.mockResolvedValue([]);
      await build().listTopups({ ...RANGE, platform: 'ios', q: 'asha' });
      const values = sqlOf(0).values;
      expect(values).toContain('ios');
      // once for the alias test, once for the ID-prefix test
      expect(values.filter((v) => v === 'asha')).toHaveLength(2);
    });

    it('lists real payments only, never test, test-mode or refunded ones', async () => {
      queryRaw.mockResolvedValue([]);
      await build().listTopups(RANGE);
      const sql = sqlOf(0).sql;
      expect(sql).toContain('WHERE t.is_payment');
      expect(sql).toContain("<> 'Sandbox'");
      expect(sql).toContain('apple_transactions');
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

    it('counts only credits for a call as earnings', async () => {
      queryRaw.mockResolvedValue([]);
      await build().mentors(RANGE);
      expect(sqlOf(0).sql).toContain(
        "le.type = 'SESSION_CREDIT' AND le.session_id IS NOT NULL",
      );
    });

    it('reports how earnings are spread', async () => {
      queryRaw.mockResolvedValue([
        mrow(1, { earned_minor: 60_000n, sessions: 6 }),
        mrow(2, { earned_minor: 30_000n, sessions: 3 }),
        mrow(3, { earned_minor: 10_000n, sessions: 1 }),
      ]);
      const { stats } = await build().mentors(RANGE);
      expect(stats).toEqual({
        mentorsEarning: 3,
        totalEarnedMinor: 100_000,
        topOneShare: 0.6,
        topThreeShare: 1,
        averagePerCallMinor: 10_000, // 100 000 over 10 calls
      });
    });
  });

  describe('mentorStats', () => {
    const m = (earnedMinor: number, sessions: number): MoneyMentor => ({
      id: `m-${earnedMinor}`,
      name: 'x',
      uniqueId: null,
      sessions,
      minutes: earnedMinor / 1000,
      earnedMinor,
      paidOutMinor: 0,
      balanceMinor: 0,
    });

    it('is empty, not a divide-by-zero, when nobody earned', () => {
      expect(mentorStats([])).toEqual({
        mentorsEarning: 0,
        totalEarnedMinor: 0,
        topOneShare: null,
        topThreeShare: null,
        averagePerCallMinor: null,
      });
    });

    it('ignores a mentor who was only paid out', () => {
      const s = mentorStats([m(10_000, 2), m(0, 0)]);
      expect(s.mentorsEarning).toBe(1);
      expect(s.topOneShare).toBe(1);
    });

    it('takes the top three of many', () => {
      const s = mentorStats([
        m(50_000, 5),
        m(20_000, 2),
        m(20_000, 2),
        m(10_000, 1),
      ]);
      expect(s.topOneShare).toBe(0.5);
      expect(s.topThreeShare).toBe(0.9);
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
          paid_minor: 32_500,
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
          paid_minor: null,
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
      // a name that looks like a formula is neutralised; the iOS price is Apple's
      expect(lines[1]).toBe(
        `"2026-11-01T10:00:00.000Z","'=HYPERLINK(""x"")","A112600001","ASPIRANT","ios",10,325`,
      );
      // an unknown price is a blank cell, not a zero
      expect(lines[2]).toBe(
        '"2026-11-02T10:00:00.000Z","Ravi",,"ASPIRANT","android",20,',
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
