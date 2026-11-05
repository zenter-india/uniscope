import { ForbiddenException } from '@nestjs/common';
import { VerificationStatus } from '@prisma/client';
import type { PrismaService } from '../../database/prisma/prisma.service.js';

export const ACCOUNT_UNDER_REVIEW_CODE = 'ACCOUNT_UNDER_REVIEW';
export const ACCOUNT_UNDER_REVIEW_MESSAGE =
  'Your profile is under review. Contact Uniscope support to rectify.';

/** An admin can put any account UNDER_REVIEW (Users -> Edit). While it is, the
 * user can't start a chat or reply to anyone -- the support channel is the
 * one exception and doesn't call this. Reading existing conversations stays
 * available. */
export async function assertNotUnderReview(
  prisma: Pick<PrismaService, 'user'>,
  userId: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { verificationStatus: true },
  });
  if (user?.verificationStatus === VerificationStatus.UNDER_REVIEW) {
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: ACCOUNT_UNDER_REVIEW_CODE,
      message: ACCOUNT_UNDER_REVIEW_MESSAGE,
    });
  }
}
