import type { AdminAccount } from '@prisma/client';

/** Allowlisted projection -- passwordHash never leaves this module, matching
 * the toXResponse() convention used everywhere else in this backend. */
export interface AdminAccountResponse {
  id: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function toAdminAccountResponse(
  row: AdminAccount,
): AdminAccountResponse {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
