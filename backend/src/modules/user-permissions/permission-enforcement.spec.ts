import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionType, VerificationStatus } from '@prisma/client';
import { PERMISSION_DENIED_CODE } from '../../common/helpers/user-permissions.helper.js';
import { PayoutsService } from '../payouts/payouts.service.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import { SessionsService } from '../sessions/sessions.service.js';
import { UniversityReviewsService } from '../university-reviews/university-reviews.service.js';

// One test per place an admin-revoked permission is enforced (the chat send
// check is covered in chat.controller.spec.ts). Each: revoked -> 403 with the
// PERMISSION_DENIED code and nothing further happens; not revoked -> the
// request gets past the permission check.

type Denials = Set<string>;

/** `userPermissionDenial.findUnique` answers a row for each revoked key. */
function prismaWith(denied: Denials, extra: Record<string, unknown> = {}) {
  return {
    userPermissionDenial: {
      findUnique: jest
        .fn()
        .mockImplementation(
          ({
            where,
          }: {
            where: { userId_permission: { permission: string } };
          }) =>
            Promise.resolve(
              denied.has(where.userId_permission.permission)
                ? { userId: 'u' }
                : null,
            ),
        ),
    },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ verificationStatus: VerificationStatus.VERIFIED }),
    },
    ...extra,
  };
}

function build<T>(Service: { prototype: T }, prisma: unknown): T {
  const svc = Object.create(Service.prototype as object) as T;
  (svc as unknown as { prisma: unknown }).prisma = prisma;
  return svc;
}

async function expectDenied(p: Promise<unknown>) {
  const err: unknown = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ForbiddenException);
  expect(
    ((err as ForbiddenException).getResponse() as { code: string }).code,
  ).toBe(PERMISSION_DENIED_CODE);
}

describe('permission enforcement points', () => {
  describe('payouts.requestPayout (PAYOUT_REQUEST)', () => {
    it('is blocked before anything else is looked at', async () => {
      const payoutRequest = { findFirst: jest.fn() };
      const svc = build(
        PayoutsService,
        prismaWith(new Set(['PAYOUT_REQUEST']), { payoutRequest }),
      );
      await expectDenied(svc.requestPayout('m1'));
      expect(payoutRequest.findFirst).not.toHaveBeenCalled();
    });

    it('proceeds when not revoked', async () => {
      const payoutRequest = {
        findFirst: jest.fn().mockResolvedValue({ id: 'open' }),
      };
      const svc = build(
        PayoutsService,
        prismaWith(new Set(), { payoutRequest }),
      );
      // An open request already exists -> 409, proving we got past the check.
      await expect(svc.requestPayout('m1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('is not blocked by an unrelated revoked permission', async () => {
      const payoutRequest = {
        findFirst: jest.fn().mockResolvedValue({ id: 'open' }),
      };
      const svc = build(
        PayoutsService,
        prismaWith(new Set(['CHAT_SEND']), { payoutRequest }),
      );
      await expect(svc.requestPayout('m1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('reviews.create (REVIEW_POST)', () => {
    const dto = { sessionId: 's1', rating: 5 } as never;

    it('is blocked', async () => {
      const session = { findFirst: jest.fn() };
      const svc = build(
        ReviewsService,
        prismaWith(new Set(['REVIEW_POST']), { session }),
      );
      await expectDenied(svc.create('a1', dto));
      expect(session.findFirst).not.toHaveBeenCalled();
    });

    it('proceeds when not revoked', async () => {
      const session = { findFirst: jest.fn().mockResolvedValue(null) };
      const svc = build(ReviewsService, prismaWith(new Set(), { session }));
      await expect(svc.create('a1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(session.findFirst).toHaveBeenCalled();
    });
  });

  describe('university-reviews.create (REVIEW_POST)', () => {
    const dto = {} as never;

    it('is blocked', async () => {
      const user = { findUniqueOrThrow: jest.fn() };
      const svc = build(
        UniversityReviewsService,
        prismaWith(new Set(['REVIEW_POST']), { user }),
      );
      await expectDenied(svc.create('u1', 'uni1', dto));
      expect(user.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('proceeds when not revoked', async () => {
      const user = {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ verificationStatus: VerificationStatus.DRAFT }),
      };
      const university = { findUnique: jest.fn().mockResolvedValue(null) };
      const svc = build(
        UniversityReviewsService,
        prismaWith(new Set(), { user, university }),
      );
      // Fails the next rule (not verified), proving we got past the check.
      const err: unknown = await svc
        .create('u1', 'uni1', dto)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(
        ((err as ForbiddenException).getResponse() as { code?: string }).code,
      ).not.toBe(PERMISSION_DENIED_CODE);
      expect(user.findUniqueOrThrow).toHaveBeenCalled();
    });
  });

  describe('sessions.create (CALL_BOOKING)', () => {
    const call = {
      mentorId: 'm1',
      type: SessionType.AUDIO_CALL,
      callSlotMinutes: 6,
    } as never;

    it('blocks booking an audio call', async () => {
      const prisma = prismaWith(new Set(['CALL_BOOKING']));
      const svc = build(SessionsService, prisma);
      await expectDenied(svc.create('a1', call));
    });

    it('does not block starting a chat (only calls are gated)', async () => {
      const prisma = prismaWith(new Set(['CALL_BOOKING']));
      const svc = build(SessionsService, prisma);
      // The rest of create() needs more mocks than this test provides; all
      // that matters is that the CALL_BOOKING lookup never happened.
      await svc
        .create('a1', { mentorId: 'm1', type: SessionType.CHAT })
        .catch(() => undefined);
      expect(prisma.userPermissionDenial.findUnique).not.toHaveBeenCalled();
    });

    it('is not blocked by an unrelated revoked permission', async () => {
      const prisma = prismaWith(new Set(['CHAT_SEND']));
      const svc = build(SessionsService, prisma);
      const err: unknown = await svc
        .create('a1', call)
        .catch((e: unknown) => e);
      // It fails later for lack of other mocks, but not with PERMISSION_DENIED.
      expect((err as { response?: { code?: string } }).response?.code).not.toBe(
        PERMISSION_DENIED_CODE,
      );
    });
  });

  describe('sessions.accept (CALL_ACCEPT)', () => {
    const session = { id: 's1', mentorId: 'm1', aspirantId: 'a1' };

    it('blocks a mentor from accepting', async () => {
      const prisma = prismaWith(new Set(['CALL_ACCEPT']), {
        session: { findUnique: jest.fn().mockResolvedValue(session) },
      });
      const svc = build(SessionsService, prisma);
      await expectDenied(svc.accept('s1', 'm1'));
    });

    it('still rejects someone who is not the session mentor first', async () => {
      const prisma = prismaWith(new Set(['CALL_ACCEPT']), {
        session: { findUnique: jest.fn().mockResolvedValue(session) },
      });
      const svc = build(SessionsService, prisma);
      const err: unknown = await svc
        .accept('s1', 'other')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(prisma.userPermissionDenial.findUnique).not.toHaveBeenCalled();
    });
  });
});
