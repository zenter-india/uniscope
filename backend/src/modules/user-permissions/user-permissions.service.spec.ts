import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../../database/prisma/prisma.service.js';
import { UserPermissionsService } from './user-permissions.service.js';

const T0 = new Date('2026-11-01T10:00:00Z');

function setup(opts: {
  role?: UserRole;
  user?: boolean;
  denials?: {
    permission: string;
    createdAt?: Date;
    deniedBy?: string | null;
    reason?: string | null;
  }[];
  events?: Record<string, unknown>[];
}) {
  const role = opts.role ?? UserRole.ASPIRANT;
  const denials = opts.denials ?? [];
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(
        opts.user === false
          ? null
          : {
              id: 'u1',
              displayName: 'Jade',
              uniqueId: 'A1',
              role,
            },
      ),
    },
    userPermissionDenial: {
      findMany: jest.fn().mockResolvedValue(
        denials.map((d) => ({
          userId: 'u1',
          createdAt: T0,
          deniedBy: null,
          reason: null,
          ...d,
        })),
      ),
      deleteMany: jest.fn().mockReturnValue('deleteMany'),
      createMany: jest.fn().mockReturnValue('createDenials'),
    },
    userPermissionEvent: {
      findMany: jest.fn().mockResolvedValue(opts.events ?? []),
      createMany: jest.fn().mockReturnValue('createEvents'),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const service = new UserPermissionsService(
    prisma as unknown as PrismaService,
  );
  return { service, prisma };
}

describe('UserPermissionsService', () => {
  describe('get', () => {
    it('lists only the permissions for the user role, all allowed by default', async () => {
      const { service } = setup({});
      const view = await service.get('u1');
      const keys = view.permissions.map((p) => p.key);
      expect(keys).toContain('CALL_BOOKING');
      expect(keys).not.toContain('CALL_ACCEPT');
      expect(view.permissions.every((p) => p.allowed)).toBe(true);
    });

    it('shows who denied what, when and why', async () => {
      const { service } = setup({
        denials: [
          {
            permission: 'CHAT_SEND',
            createdAt: T0,
            deniedBy: 'admin@uniscope.in',
            reason: 'Spam reports',
          },
        ],
      });
      const view = await service.get('u1');
      const chat = view.permissions.find((p) => p.key === 'CHAT_SEND')!;
      expect(chat).toMatchObject({
        allowed: false,
        deniedAt: T0,
        deniedBy: 'admin@uniscope.in',
        reason: 'Spam reports',
      });
      const booking = view.permissions.find((p) => p.key === 'CALL_BOOKING')!;
      expect(booking).toMatchObject({
        allowed: true,
        deniedAt: null,
        deniedBy: null,
        reason: null,
      });
    });

    it('returns history newest first with permission labels', async () => {
      const { service, prisma } = setup({
        events: [
          {
            permission: 'CHAT_SEND',
            action: 'DENY',
            adminEmail: 'a@x.in',
            reason: 'Spam',
            createdAt: T0,
          },
        ],
      });
      const view = await service.get('u1');
      expect(prisma.userPermissionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
      expect(view.history[0]).toMatchObject({
        permission: 'CHAT_SEND',
        label: 'Send chat messages',
        action: 'DENY',
        adminEmail: 'a@x.in',
        reason: 'Spam',
        at: T0,
      });
    });

    it('404s an unknown user and rejects admin accounts', async () => {
      await expect(
        setup({ user: false }).service.get('u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        setup({ role: UserRole.ADMIN }).service.get('u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('setDenied', () => {
    it('requires a reason when something is newly denied, and writes nothing without it', async () => {
      const { service, prisma } = setup({});
      await expect(
        service.setDenied('u1', ['CHAT_SEND'], { adminEmail: 'a@x.in' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.setDenied('u1', ['CHAT_SEND'], { reason: ' ab ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a reason over 300 characters', async () => {
      const { service, prisma } = setup({});
      await expect(
        service.setDenied('u1', ['CHAT_SEND'], { reason: 'x'.repeat(301) }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('records who denied it and why, and logs a DENY event', async () => {
      const { service, prisma } = setup({});
      await service.setDenied('u1', ['CHAT_SEND'], {
        adminEmail: ' admin@uniscope.in ',
        reason: '  Spam reports  ',
      });
      expect(prisma.userPermissionDenial.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: 'u1',
            permission: 'CHAT_SEND',
            deniedBy: 'admin@uniscope.in',
            reason: 'Spam reports',
          },
        ],
      });
      expect(prisma.userPermissionEvent.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: 'u1',
            permission: 'CHAT_SEND',
            action: 'DENY',
            adminEmail: 'admin@uniscope.in',
            reason: 'Spam reports',
          },
        ],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('keeps the original date/admin/reason of an already-denied permission', async () => {
      const { service, prisma } = setup({
        denials: [
          { permission: 'CHAT_SEND', deniedBy: 'old@x.in', reason: 'old' },
        ],
      });
      // CHAT_SEND stays denied; REVIEW_POST is newly denied.
      await service.setDenied('u1', ['CHAT_SEND', 'REVIEW_POST'], {
        adminEmail: 'new@x.in',
        reason: 'New reason',
      });
      expect(prisma.userPermissionDenial.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            permission: 'REVIEW_POST',
            deniedBy: 'new@x.in',
          }),
        ],
      });
      expect(prisma.userPermissionDenial.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', permission: { in: [] } },
      });
    });

    it('re-allows removed permissions without needing a reason, and logs an ALLOW event', async () => {
      const { service, prisma } = setup({
        denials: [{ permission: 'CHAT_SEND' }, { permission: 'REVIEW_POST' }],
      });
      await service.setDenied('u1', ['REVIEW_POST'], { adminEmail: 'a@x.in' });
      expect(prisma.userPermissionDenial.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', permission: { in: ['CHAT_SEND'] } },
      });
      expect(prisma.userPermissionDenial.createMany).toHaveBeenCalledWith({
        data: [],
      });
      expect(prisma.userPermissionEvent.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: 'u1',
            permission: 'CHAT_SEND',
            action: 'ALLOW',
            adminEmail: 'a@x.in',
            reason: null,
          },
        ],
      });
    });

    it('does nothing when nothing changed (no reason needed, no history noise)', async () => {
      const { service, prisma } = setup({
        denials: [{ permission: 'CHAT_SEND' }],
      });
      await service.setDenied('u1', ['CHAT_SEND']);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('treats duplicate keys in the request as one', async () => {
      const { service, prisma } = setup({});
      await service.setDenied('u1', ['CHAT_SEND', 'CHAT_SEND'], {
        reason: 'Spam',
      });
      expect(prisma.userPermissionDenial.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ permission: 'CHAT_SEND' })],
      });
    });

    it('rejects unknown keys and keys for another role, writing nothing', async () => {
      const { service, prisma } = setup({ role: UserRole.ASPIRANT });
      await expect(
        service.setDenied('u1', ['NOPE'], { reason: 'abc' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      // CALL_ACCEPT is a mentor-only permission.
      await expect(
        service.setDenied('u1', ['CALL_ACCEPT'], { reason: 'abc' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects admin accounts and unknown users', async () => {
      await expect(
        setup({ role: UserRole.ADMIN }).service.setDenied('u1', [], {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        setup({ user: false }).service.setDenied('u1', [], {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
