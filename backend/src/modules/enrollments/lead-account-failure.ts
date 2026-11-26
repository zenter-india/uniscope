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

/**
 * The steps of turning a website sign-up into an account, in order. A failure
 * is saved with the step it stopped at, so the admin can see how far it got:
 *  - 'account'  creating the account (or giving an existing one the role);
 *  - 'document' sending the mentor's college ID for review. The account exists
 *               by now, but the document was not sent;
 *  - 'link'     linking the account back to the sign-up. The account exists,
 *               and so does the document request, but the sign-up does not
 *               know it yet.
 */
export type AccountStep = 'account' | 'document' | 'link';

/**
 * An error that remembers which step it came from. It keeps the original
 * message and stack, so everything that reads the message (the reason shown to
 * the admin, the clash detection on retry) works as it did before.
 */
export class AccountStepError extends Error {
  constructor(
    readonly step: AccountStep,
    readonly original: unknown,
  ) {
    super(original instanceof Error ? original.message : String(original));
    this.name = 'AccountStepError';
    if (original instanceof Error && original.stack)
      this.stack = original.stack;
  }
}

/** The step a failure stopped at, or null when it did not come from one. */
export function accountStepOf(err: unknown): AccountStep | null {
  return err instanceof AccountStepError ? err.step : null;
}

/** The step in plain words, for a spreadsheet. Empty for a step this code does
 * not know (or none). */
export function describeAccountStep(step: string | null): string {
  switch (step) {
    case 'account':
      return 'Creating the account';
    case 'document':
      return 'Sending the college ID for review';
    case 'link':
      return 'Linking the account to the sign-up';
    default:
      return '';
  }
}

/**
 * The account columns of the CSV export. A sign-up that still has no account
 * (and was not rejected on purpose) always says something in the step and reason
 * columns, "Not recorded" when nothing was saved, so an empty cell never looks
 * like "no problem". A sign-up with an account, or a rejected one, has none.
 */
export function accountExportColumns(lead: {
  convertedUserId: string | null;
  status: string;
  accountFailureStep: string | null;
  accountFailureReason: string | null;
  accountFailedAt: Date | null;
}): { hasAccount: string; step: string; reason: string; failedAt: string } {
  const noAccount = lead.convertedUserId === null;
  const unrecorded =
    noAccount && lead.status !== EnrollmentLeadStatus.REJECTED
      ? 'Not recorded'
      : '';
  return {
    hasAccount: noAccount ? 'No' : 'Yes',
    step: describeAccountStep(lead.accountFailureStep) || unrecorded,
    reason: lead.accountFailureReason ?? unrecorded,
    failedAt: lead.accountFailedAt?.toISOString() ?? '',
  };
}

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
