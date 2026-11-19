import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { CreatePromotionDto } from './dto/create-promotion.dto.js';
import {
  MAX_CREDITED_RECIPIENTS,
  PromotionsService,
} from './promotions.service.js';

type Recipient = { id: string; role: UserRole };

function build(recipients: Recipient[], walletUserIds?: string[]) {
  const userGroupBy = jest.fn().mockResolvedValue([]);
  const userFindMany = jest.fn().mockResolvedValue(recipients);
  const promotionCreate = jest.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: 'promo-1',
      body: null,
      linkUrl: null,
      linkLabel: null,
      creditedCount: 0,
      createdAt: new Date('2026-11-16T00:00:00Z'),
      ...args.data,
    }),
  );
  const promotionUpdate = jest.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: 'promo-1',
      title: 't',
      body: null,
      audience: 'ALL',
      linkUrl: null,
      linkLabel: null,
      aspirantCreditMinor: 0,
      mentorCreditMinor: 0,
      recipientCount: recipients.length,
      createdAt: new Date('2026-11-16T00:00:00Z'),
      ...args.data,
    }),
  );
  const recipientCreateMany = jest.fn().mockResolvedValue({ count: 0 });
  const recipientUpdate = jest.fn().mockResolvedValue({});
  const recipientFindUnique = jest.fn();
  const recipientUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const walletFindMany = jest.fn().mockResolvedValue(
    (walletUserIds ?? recipients.map((r) => r.id)).map((userId) => ({
      id: `wallet-${userId}`,
      userId,
    })),
  );
  const tx = {
    promotion: { create: promotionCreate },
    promotionRecipient: { createMany: recipientCreateMany },
  };
  const prisma = {
    user: { findMany: userFindMany, groupBy: userGroupBy },
    wallet: { findMany: walletFindMany },
    promotion: { update: promotionUpdate },
    promotionRecipient: {
      update: recipientUpdate,
      findUnique: recipientFindUnique,
      updateMany: recipientUpdateMany,
    },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;

  const sendBulk = jest.fn().mockResolvedValue(undefined);
  const applyLedgerEntry = jest.fn().mockResolvedValue(true);
  const service = new PromotionsService(
    prisma,
    { sendBulk } as unknown as NotificationsService,
    { applyLedgerEntry } as unknown as WalletService,
  );
  return {
    service,
    userGroupBy,
    userFindMany,
    promotionCreate,
    recipientCreateMany,
    recipientUpdate,
    recipientFindUnique,
    recipientUpdateMany,
    sendBulk,
    applyLedgerEntry,
  };
}

const asp = (id: string): Recipient => ({ id, role: UserRole.ASPIRANT });
const men = (id: string): Recipient => ({ id, role: UserRole.MENTOR });

describe('PromotionsService.create -- validation', () => {
  it('refuses a Uniminutes credit for a mentors-only promotion', async () => {
    const { service } = build([men('m1')]);
    await expect(
      service.create(
        { title: 'Hi', audience: 'MENTOR', aspirantUniminutes: 5 },
        'admin',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a rupee credit for a students-only promotion', async () => {
    const { service } = build([asp('a1')]);
    await expect(
      service.create(
        { title: 'Hi', audience: 'ASPIRANT', mentorRupees: 100 },
        'admin',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('needs at least one user for a SELECTED promotion', async () => {
    const { service } = build([asp('a1')]);
    await expect(
      service.create(
        { title: 'Hi', audience: 'SELECTED', userIds: [] },
        'admin',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses when nobody is eligible', async () => {
    const { service } = build([]);
    await expect(
      service.create({ title: 'Hi', audience: 'ALL' }, 'admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a credited promotion that is too large', async () => {
    const many = Array.from({ length: MAX_CREDITED_RECIPIENTS + 1 }, (_, i) =>
      asp(`a${i}`),
    );
    const { service, applyLedgerEntry } = build(many);
    await expect(
      service.create(
        { title: 'Hi', audience: 'ASPIRANT', aspirantUniminutes: 1 },
        'admin',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(applyLedgerEntry).not.toHaveBeenCalled();
  });

  it('narrows a SELECTED promotion to the chosen, eligible accounts', async () => {
    const { service, userFindMany } = build([asp('a1')]);
    await service.create(
      { title: 'Hi', audience: 'SELECTED', userIds: ['a1', 'x2'] },
      'admin',
    );
    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        isBanned: false,
        deletedAt: null,
        role: { in: [UserRole.ASPIRANT, UserRole.MENTOR] },
        id: { in: ['a1', 'x2'] },
      },
      select: { id: true, role: true },
    });
  });
});

describe('PromotionsService.create -- message only', () => {
  it('sends the notification, writes recipients, and never touches wallets', async () => {
    const { service, sendBulk, applyLedgerEntry, recipientCreateMany } = build([
      asp('a1'),
      men('m1'),
    ]);
    const res = await service.create(
      { title: ' Diwali offer ', body: ' Hello ', audience: 'ALL' },
      'admin-1',
    );
    expect(applyLedgerEntry).not.toHaveBeenCalled();
    expect(recipientCreateMany).toHaveBeenCalledWith({
      data: [
        { promotionId: 'promo-1', userId: 'a1' },
        { promotionId: 'promo-1', userId: 'm1' },
      ],
      skipDuplicates: true,
    });
    expect(sendBulk).toHaveBeenCalledWith(
      ['a1', 'm1'],
      expect.objectContaining({
        type: 'SYSTEM',
        title: 'Diwali offer',
        body: 'Hello',
        metadata: { promotion: 'true', promotionId: 'promo-1' },
      }),
    );
    expect(res.title).toBe('Diwali offer');
    expect(res.recipientCount).toBe(2);
    expect(res.creditedCount).toBe(0);
  });
});

describe('PromotionsService.create -- link', () => {
  it('defaults the button label to "Open" and carries the link in the notification', async () => {
    const { service, promotionCreate, sendBulk } = build([asp('a1')]);
    await service.create(
      { title: 'Hi', audience: 'ALL', linkUrl: 'https://uniscope.in/offer' },
      'admin',
    );
    const data = (
      promotionCreate.mock.calls[0] as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(data.linkUrl).toBe('https://uniscope.in/offer');
    expect(data.linkLabel).toBe('Open');
    expect(sendBulk).toHaveBeenCalledWith(
      ['a1'],
      expect.objectContaining({
        metadata: expect.objectContaining({
          linkUrl: 'https://uniscope.in/offer',
        }) as Record<string, string>,
      }),
    );
  });

  it('drops a label that has no link', async () => {
    const { service, promotionCreate } = build([asp('a1')]);
    await service.create(
      { title: 'Hi', audience: 'ALL', linkLabel: 'Click' },
      'admin',
    );
    const data = (
      promotionCreate.mock.calls[0] as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(data.linkUrl).toBeNull();
    expect(data.linkLabel).toBeNull();
  });
});

describe('PromotionsService.create -- wallet credit', () => {
  it('credits Uniminutes to aspirants and rupees to mentors, once each', async () => {
    const { service, applyLedgerEntry, recipientUpdate } = build([
      asp('a1'),
      men('m1'),
    ]);
    const res = await service.create(
      {
        title: 'Bonus',
        audience: 'ALL',
        aspirantUniminutes: 5,
        mentorRupees: 200,
      },
      'admin',
    );
    expect(applyLedgerEntry).toHaveBeenCalledTimes(2);
    expect(applyLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'wallet-a1',
        type: 'ADJUSTMENT',
        amountMinor: 5000, // 5 Uniminutes
        idempotencyKey: 'promotion:promo-1:a1',
      }),
    );
    expect(applyLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'wallet-m1',
        amountMinor: 20000, // 200 rupees
        idempotencyKey: 'promotion:promo-1:m1',
      }),
    );
    expect(recipientUpdate).toHaveBeenCalledTimes(2);
    expect(res.creditedCount).toBe(2);
  });

  it('skips a recipient with no wallet and still credits the rest', async () => {
    const { service, applyLedgerEntry } = build([asp('a1'), asp('a2')], ['a2']);
    const res = await service.create(
      { title: 'Bonus', audience: 'ASPIRANT', aspirantUniminutes: 1 },
      'admin',
    );
    expect(applyLedgerEntry).toHaveBeenCalledTimes(1);
    expect(res.creditedCount).toBe(1);
  });

  it('keeps going when one credit fails', async () => {
    const { service, applyLedgerEntry } = build([asp('a1'), asp('a2')]);
    applyLedgerEntry.mockRejectedValueOnce(new Error('db down'));
    const res = await service.create(
      { title: 'Bonus', audience: 'ASPIRANT', aspirantUniminutes: 1 },
      'admin',
    );
    expect(applyLedgerEntry).toHaveBeenCalledTimes(2);
    expect(res.creditedCount).toBe(1);
  });

  it('does not count or record a credit that was already applied', async () => {
    const { service, applyLedgerEntry, recipientUpdate } = build([asp('a1')]);
    applyLedgerEntry.mockResolvedValueOnce(false);
    const res = await service.create(
      { title: 'Bonus', audience: 'ASPIRANT', aspirantUniminutes: 1 },
      'admin',
    );
    expect(recipientUpdate).not.toHaveBeenCalled();
    expect(res.creditedCount).toBe(0);
  });
});

describe('PromotionsService.previewCount', () => {
  it('splits the reach by role', async () => {
    const { service, userGroupBy } = build([]);
    userGroupBy.mockResolvedValue([
      { role: UserRole.ASPIRANT, _count: { _all: 7 } },
      { role: UserRole.MENTOR, _count: { _all: 3 } },
    ]);
    await expect(service.previewCount('ALL')).resolves.toEqual({
      recipientCount: 10,
      aspirantCount: 7,
      mentorCount: 3,
    });
  });

  it('reports zero for a role with nobody in it', async () => {
    const { service, userGroupBy } = build([]);
    userGroupBy.mockResolvedValue([
      { role: UserRole.MENTOR, _count: { _all: 2 } },
    ]);
    await expect(service.previewCount('MENTOR')).resolves.toEqual({
      recipientCount: 2,
      aspirantCount: 0,
      mentorCount: 2,
    });
  });
});

describe('PromotionsService.markSeen', () => {
  it('404s for someone who was never a recipient', async () => {
    const { service, recipientFindUnique } = build([]);
    recipientFindUnique.mockResolvedValue(null);
    await expect(service.markSeen('u1', 'promo-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('marks it seen once, and is a no-op the second time', async () => {
    const { service, recipientFindUnique, recipientUpdateMany } = build([]);
    recipientFindUnique.mockResolvedValueOnce({ seenAt: null });
    await service.markSeen('u1', 'promo-1');
    expect(recipientUpdateMany).toHaveBeenCalledTimes(1);

    recipientFindUnique.mockResolvedValueOnce({ seenAt: new Date() });
    await service.markSeen('u1', 'promo-1');
    expect(recipientUpdateMany).toHaveBeenCalledTimes(1);
  });
});

describe('CreatePromotionDto -- link and credit rules', () => {
  const check = async (input: Record<string, unknown>) =>
    validate(
      plainToInstance(CreatePromotionDto, {
        title: 'Hi',
        audience: 'ALL',
        ...input,
      }),
    );

  it('accepts an https link', async () => {
    expect(await check({ linkUrl: 'https://uniscope.in/offer' })).toHaveLength(
      0,
    );
  });

  it.each([
    'http://uniscope.in',
    'javascript:alert(1)',
    'tel:+911234567890',
    'file:///etc/passwd',
    'uniscope.in/offer',
  ])('rejects the link %s', async (linkUrl) => {
    expect((await check({ linkUrl })).length).toBeGreaterThan(0);
  });

  it('rejects a negative, fractional or oversized credit', async () => {
    expect((await check({ aspirantUniminutes: -1 })).length).toBeGreaterThan(0);
    expect((await check({ mentorRupees: 1.5 })).length).toBeGreaterThan(0);
    expect((await check({ aspirantUniminutes: 1001 })).length).toBeGreaterThan(
      0,
    );
    expect((await check({ mentorRupees: 10001 })).length).toBeGreaterThan(0);
  });

  it('rejects an unknown audience', async () => {
    expect((await check({ audience: 'EVERYONE' })).length).toBeGreaterThan(0);
  });
});

describe('PromotionsService.recipientsOf', () => {
  function buildHistory(opts: { promotion: boolean; total?: number }) {
    const recipientFindMany = jest.fn().mockResolvedValue([
      {
        userId: 'u1',
        creditedMinor: 6000,
        seenAt: new Date('2026-11-19T10:00:00Z'),
      },
      { userId: 'u2', creditedMinor: 0, seenAt: null },
      { userId: 'gone', creditedMinor: 0, seenAt: null },
    ]);
    const prisma = {
      promotion: {
        findUnique: jest.fn().mockResolvedValue(opts.promotion ? { id: 'p1' } : null),
      },
      promotionRecipient: {
        findMany: recipientFindMany,
        count: jest.fn().mockResolvedValue(opts.total ?? 3),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'u1', displayName: 'Asha', role: UserRole.ASPIRANT, uniqueId: 'A1' },
          { id: 'u2', displayName: 'Ravi', role: UserRole.MENTOR, uniqueId: 'M1' },
        ]),
      },
    } as unknown as PrismaService;
    const service = new PromotionsService(
      prisma,
      {} as NotificationsService,
      {} as WalletService,
    );
    return { service, recipientFindMany };
  }

  it('lists who got it, with credit and seen state', async () => {
    const { service } = buildHistory({ promotion: true });
    const res = await service.recipientsOf('p1');
    expect(res.total).toBe(3);
    expect(res.truncated).toBe(false);
    expect(res.recipients[0]).toEqual({
      userId: 'u1',
      displayName: 'Asha',
      role: UserRole.ASPIRANT,
      uniqueId: 'A1',
      creditedMinor: 6000,
      seenAt: '2026-11-19T10:00:00.000Z',
    });
    expect(res.recipients[1].seenAt).toBeNull();
  });

  it('still lists a recipient whose account no longer exists', async () => {
    const { service } = buildHistory({ promotion: true });
    const res = await service.recipientsOf('p1');
    expect(res.recipients[2]).toMatchObject({
      userId: 'gone',
      displayName: 'Deleted user',
      role: null,
      uniqueId: null,
    });
  });

  it('says so when the list is cut short', async () => {
    const { service } = buildHistory({ promotion: true, total: 5000 });
    const res = await service.recipientsOf('p1');
    expect(res.total).toBe(5000);
    expect(res.truncated).toBe(true);
  });

  it('404s for an unknown promotion', async () => {
    const { service } = buildHistory({ promotion: false });
    await expect(service.recipientsOf('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
