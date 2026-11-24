import { ConfigService } from '@nestjs/config';
import { LedgerEntryType, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { WalletService } from './wallet.service.js';

/** UNI-17: every top-up records where it was made, for the admin Money page. */
describe('WalletService — platform of a top-up', () => {
  const userFindUnique = jest.fn();
  const walletFindUnique = jest.fn();
  const ordersCreate = jest.fn();
  const ordersFetch = jest.fn();
  const ledgerCreate = jest.fn<
    Promise<unknown>,
    [{ data: { platform?: string } }]
  >();
  const txQueryRaw = jest.fn();
  const send = jest.fn();

  const buildService = (): WalletService => {
    const config = {
      get: (key: string) =>
        key === 'razorpay'
          ? { keyId: 'rzp_test_key', keySecret: 'secret', webhookSecret: 'wh' }
          : { bundleId: '' },
    } as unknown as ConfigService;
    const prisma = {
      user: { findUnique: userFindUnique },
      wallet: { findUnique: walletFindUnique },
      $transaction: (fn: (tx: unknown) => Promise<void>) =>
        fn({
          $queryRaw: txQueryRaw,
          ledgerEntry: { create: ledgerCreate },
        }),
    } as unknown as PrismaService;
    const service = new WalletService(prisma, config, {
      send,
    } as unknown as NotificationsService);
    (
      service as unknown as {
        razorpay: { orders: { create: jest.Mock; fetch: jest.Mock } };
      }
    ).razorpay = { orders: { create: ordersCreate, fetch: ordersFetch } };
    return service;
  };

  beforeEach(() => {
    for (const m of [
      userFindUnique,
      walletFindUnique,
      ordersCreate,
      ordersFetch,
      ledgerCreate,
      txQueryRaw,
      send,
    ]) {
      m.mockReset();
    }
    userFindUnique.mockResolvedValue({ role: UserRole.ASPIRANT });
    walletFindUnique.mockResolvedValue({ id: 'wallet-1' });
    ordersCreate.mockResolvedValue({ id: 'order_1' });
    txQueryRaw.mockResolvedValue([{ balance_minor: 10_000 }]);
    ledgerCreate.mockResolvedValue({});
    send.mockResolvedValue(undefined);
  });

  describe('createTopupOrder', () => {
    it('puts the platform in the order notes when the app says where it is', async () => {
      await buildService().createTopupOrder('asp-1', {
        amountMinor: 25_000,
        platform: 'web',
      });
      expect(ordersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: { userId: 'asp-1', platform: 'web' },
        }),
      );
    });

    it('leaves it out when an older app build says nothing', async () => {
      await buildService().createTopupOrder('asp-1', { amountMinor: 25_000 });
      expect(ordersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ notes: { userId: 'asp-1' } }),
      );
    });
  });

  describe('handleTopupCaptured', () => {
    const event = (amount: number) => ({
      payload: {
        payment: {
          entity: { id: 'pay_1', order_id: 'order_1', amount },
        },
      },
    });

    const credit = async (notes: Record<string, string>, amount: number) => {
      ordersFetch.mockResolvedValue({ notes });
      const service = buildService();
      const spy = jest
        .spyOn(service, 'applyLedgerEntry')
        .mockResolvedValue(true);
      await service.handleTopupCaptured(event(amount));
      expect(spy).toHaveBeenCalledTimes(1);
      return spy.mock.calls[0][0];
    };

    it('stores the platform the order was created with', async () => {
      const entry = await credit({ userId: 'asp-1', platform: 'web' }, 25_000);
      expect(entry.type).toBe(LedgerEntryType.TOPUP);
      expect(entry.platform).toBe('web');
    });

    it('works Android out from an Android price when none was declared', async () => {
      const entry = await credit({ userId: 'asp-1' }, 25_000);
      expect(entry.platform).toBe('android');
    });

    it('works iOS out from an iOS price when none was declared', async () => {
      const entry = await credit({ userId: 'asp-1' }, 52_000);
      expect(entry.platform).toBe('ios');
    });
  });

  describe('applyLedgerEntry', () => {
    const apply = (platform?: 'android' | 'ios' | 'web') =>
      buildService().applyLedgerEntry({
        walletId: 'wallet-1',
        type: LedgerEntryType.TOPUP,
        amountMinor: 10_000,
        idempotencyKey: 'razorpay:pay_1',
        platform,
      });

    it('writes the platform onto the ledger row', async () => {
      await expect(apply('ios')).resolves.toBe(true);
      const [{ data }] = ledgerCreate.mock.calls[0];
      expect(data.platform).toBe('ios');
    });

    it('leaves it empty for entries that are not top-ups', async () => {
      await apply(undefined);
      const [{ data }] = ledgerCreate.mock.calls[0];
      expect(data.platform).toBeUndefined();
    });
  });
});
