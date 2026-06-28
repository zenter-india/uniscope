import { User } from '@prisma/client';

/**
 * Client-safe view of a User. Built with an explicit allowlist so that
 * sensitive columns (phoneHash, refreshTokenHash) and internal bookkeeping
 * (deletedAt) are never serialized to API responses, and any future column
 * added to the User model stays private until deliberately exposed here.
 */
export interface PublicUser {
  id: string;
  displayName: string;
  role: User['role'];
  verificationStatus: User['verificationStatus'];
  isActive: boolean;
  isBanned: boolean;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    displayName: user.displayName,
    role: user.role,
    verificationStatus: user.verificationStatus,
    isActive: user.isActive,
    isBanned: user.isBanned,
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
