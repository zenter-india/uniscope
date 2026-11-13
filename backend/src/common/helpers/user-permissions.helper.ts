import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../../database/prisma/prisma.service.js';

/**
 * App-user permissions an admin can switch off per user (Admin panel ->
 * Permissions). Everything is allowed by default; only revocations are
 * stored (user_permission_denials). To add a permission: add it here, then
 * call assertPermission(...) at the one place the action happens.
 */
export const USER_PERMISSIONS = [
  {
    key: 'CHAT_SEND',
    label: 'Send chat messages',
    description: 'Send messages in session chats. The support chat is never blocked.',
    roles: [UserRole.ASPIRANT, UserRole.MENTOR],
  },
  {
    key: 'CALL_BOOKING',
    label: 'Book audio calls',
    description: 'Request a paid audio call with a mentor.',
    roles: [UserRole.ASPIRANT],
  },
  {
    key: 'CALL_ACCEPT',
    label: 'Accept call requests',
    description: 'Accept an aspirant’s audio-call request.',
    roles: [UserRole.MENTOR],
  },
  {
    key: 'REVIEW_POST',
    label: 'Post reviews',
    description: 'Rate a mentor after a call, or review a college.',
    roles: [UserRole.ASPIRANT, UserRole.MENTOR],
  },
  {
    key: 'PAYOUT_REQUEST',
    label: 'Request payouts',
    description: 'Withdraw earnings to a UPI ID.',
    roles: [UserRole.MENTOR],
  },
] as const;

export type UserPermissionKey = (typeof USER_PERMISSIONS)[number]['key'];

export const PERMISSION_DENIED_CODE = 'PERMISSION_DENIED';

export function permissionsForRole(role: UserRole) {
  return USER_PERMISSIONS.filter((p) => (p.roles as readonly UserRole[]).includes(role));
}

/** Throws 403 if an admin has revoked `key` for this user. One indexed
 * primary-key lookup, same cost as assertNotUnderReview. */
export async function assertPermission(
  prisma: Pick<PrismaService, 'userPermissionDenial'>,
  userId: string,
  key: UserPermissionKey,
): Promise<void> {
  const denied = await prisma.userPermissionDenial.findUnique({
    where: { userId_permission: { userId, permission: key } },
    select: { userId: true },
  });
  if (denied) {
    const label = USER_PERMISSIONS.find((p) => p.key === key)?.label ?? key;
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: PERMISSION_DENIED_CODE,
      message: `You don't have permission to do this (${label.toLowerCase()}). Contact Uniscope support if you think this is a mistake.`,
    });
  }
}
