import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../../database/prisma/prisma.service.js';
import {
  PERMISSION_DENIED_CODE,
  USER_PERMISSIONS,
  assertPermission,
  permissionsForRole,
} from './user-permissions.helper.js';

describe('user permissions helper', () => {
  describe('permissionsForRole', () => {
    it('gives aspirants booking but not accepting or payouts', () => {
      const keys = permissionsForRole(UserRole.ASPIRANT).map((p) => p.key);
      expect(keys).toEqual(
        expect.arrayContaining(['CHAT_SEND', 'CALL_BOOKING', 'REVIEW_POST']),
      );
      expect(keys).not.toContain('CALL_ACCEPT');
      expect(keys).not.toContain('PAYOUT_REQUEST');
    });

    it('gives mentors accepting and payouts but not booking', () => {
      const keys = permissionsForRole(UserRole.MENTOR).map((p) => p.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'CHAT_SEND',
          'CALL_ACCEPT',
          'REVIEW_POST',
          'PAYOUT_REQUEST',
        ]),
      );
      expect(keys).not.toContain('CALL_BOOKING');
    });

    it('gives admins nothing', () => {
      expect(permissionsForRole(UserRole.ADMIN)).toHaveLength(0);
    });

    it('has unique keys', () => {
      const keys = USER_PERMISSIONS.map((p) => p.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('assertPermission', () => {
    const prismaWith = (row: unknown) => {
      const findUnique = jest.fn().mockResolvedValue(row);
      return {
        prisma: {
          userPermissionDenial: { findUnique },
        } as unknown as PrismaService,
        findUnique,
      };
    };

    it('passes when nothing is revoked', async () => {
      const { prisma, findUnique } = prismaWith(null);
      await expect(
        assertPermission(prisma, 'u1', 'CHAT_SEND'),
      ).resolves.toBeUndefined();
      expect(findUnique).toHaveBeenCalledWith({
        where: { userId_permission: { userId: 'u1', permission: 'CHAT_SEND' } },
        select: { userId: true },
      });
    });

    it('throws a 403 carrying the PERMISSION_DENIED code when revoked', async () => {
      const { prisma } = prismaWith({ userId: 'u1' });
      const err: unknown = await assertPermission(
        prisma,
        'u1',
        'PAYOUT_REQUEST',
      ).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse() as {
        code: string;
        message: string;
        statusCode: number;
      };
      expect(body.statusCode).toBe(403);
      expect(body.code).toBe(PERMISSION_DENIED_CODE);
      expect(body.message).toContain('request payouts');
      expect(body.message).toContain('support');
    });
  });
});
