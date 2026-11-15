import { EnrollmentLeadRole, UserRole } from '@prisma/client';

/** Shown on the website form (and returned by the server) when a phone number
 * can't be used for the sign-up being filled in. */
export const PHONE_TAKEN_MESSAGE =
  'This phone number already has an account. Please use a different number.';

/**
 * Whether a website sign-up as `requested` may use a phone number whose
 * existing account (if any) has the role `existing`.
 *
 *  - No account yet: allowed.
 *  - An aspirant account signing up as a mentor: allowed. It is the same
 *    account, upgraded to mentor — the one role change the app itself supports.
 *  - Anything else is refused: aspirant again, mentor again, mentor then
 *    aspirant (there is no mentor-to-aspirant switch), or an admin's number.
 */
export function phoneSignupAllowed(
  requested: EnrollmentLeadRole,
  existing: UserRole | null | undefined,
): boolean {
  if (!existing) return true;
  return (
    requested === EnrollmentLeadRole.MENTOR && existing === UserRole.ASPIRANT
  );
}
