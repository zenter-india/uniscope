/** The most a reason in a team alert may hold. */
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
 * A short, readable reason an account could not be created, for the team alert.
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
  return reason.slice(0, REASON_MAX);
}
