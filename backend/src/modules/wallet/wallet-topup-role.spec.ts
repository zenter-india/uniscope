import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { WalletService } from './wallet.service.js';

/** UNI-64: mentors must not be able to start a wallet top-up. */
describe('WalletService.createTopupOrder -- role check', () => {
  const findUnique = jest.fn();
  const create = jest.fn();

  const buildService = (): WalletService => {
    const config = {
      get: (key: string) =>
        key === 'razorpay'
          ? { keyId: 'rzp_test_key', keySecret: 'secret', webhookSecret: 'wh' }
          : { bundleId: '' },
    } as unknown as ConfigService;
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const service = new WalletService(
      prisma,
      config,
      {} as NotificationsService,
    );
    (
      service as unknown as { razorpay: { orders: { create: jest.Mock } } }
    ).razorpay = {
      orders: { create },
    };
    return service;
  };

  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    create.mockResolvedValue({ id: 'order_123' });
  });

  it('refuses a mentor and never creates a Razorpay order', async () => {
    findUnique.mockResolvedValue({ role: UserRole.MENTOR });
    await expect(
      buildService().createTopupOrder('mentor-1', { amountMinor: 25000 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('checks the role in the database for the calling user', async () => {
    findUnique.mockResolvedValue({ role: UserRole.MENTOR });
    await buildService()
      .createTopupOrder('mentor-1', { amountMinor: 25000 })
      .catch(() => undefined);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'mentor-1' },
      select: { role: true },
    });
  });

  it('still creates an order for an aspirant', async () => {
    findUnique.mockResolvedValue({ role: UserRole.ASPIRANT });
    const res = await buildService().createTopupOrder('asp-1', {
      amountMinor: 25000,
    });
    expect(res.orderId).toBe('order_123');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
