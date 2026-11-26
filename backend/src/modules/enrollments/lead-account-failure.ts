import { EnrollmentLeadStatus, type Prisma } from '@prisma/client';

/**
 * A lead that should have an account but has none: nothing is linked to it, and
 * nobody has rejected it on purpose. One definition, used by the list filter,
 * the stats and the Overview count, so the numbers always agree.
 */
export const LEAD_WITHOUT_ACCOUNT: Prisma.EnrollmentLeadWhereInput = {
  convertedUserId: null,
  status: { not: EnrollmentLeadStatus.REJECTED },
};

/**
 * The same, but only where the server recorded why creating the account
 * failed. That is every failure since this was tracked, and none of the older
 * leads from before the website made accounts at all, which have no reason and
 * are mostly not failures. This is what the admin is told about.
 */
export const LEAD_ACCOUNT_FAILED: Prisma.EnrollmentLeadWhereInput = {
  ...LEAD_WITHOUT_ACCOUNT,
  accountFailureReason: { not: null },
};

/** The most a reason shown to an admin may hold. */
const REASON_MAX = 300;

/** The last non-empty line of an error message, shortened (Prisma errors put
 * the useful reason at the end). */
export function lastLine(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (lines[lines.length - 1] ?? 'unknown error').slice(0, 200);
}

/**
 * A short, readable reason an account could not be created, for the admin page.
 * Known causes get a plain sentence; anything else shows the last line of the
 * error. Never the raw stack, and never more than a short sentence.
 */
export function describeAccountFailure(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);

  let reason: string;
  if (/converted_user_id/i.test(text)) {
    reason =
      'This phone number already has an account that is linked to another lead.';
  } else if (/display_name/i.test(text)) {
    reason = 'The alias is already in use by another account.';
  } else if (/phone_hash/i.test(text)) {
    reason = 'This phone number already has an account.';
  } else {
    reason = lastLine(text);
  }
  // The reason is shown as a sentence, so it has to end like one. The last line
  // of an unexpected error usually does not.
  const clipped = reason.slice(0, REASON_MAX - 1);
  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
}
