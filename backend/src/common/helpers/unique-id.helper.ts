/**
 * Client-facing registration numbers for aspirant/mentor profiles.
 *
 * Format: "{A|M}{2-digit stream code}{2-digit enrolment year}
 * {7-digit yearly sequence}" — 12 characters, e.g. "A44260000001"
 * (aspirant, Arts & Humanities, enrolled in 2026, 1st in that stream that
 * year). The sequence is scoped to prefix+streamCode+year and claimed
 * atomically — see UsersService.ensureUniqueId and IdSequenceCounter —
 * and only resets when the year rolls over, never daily: the visible ID
 * carries no month/day, so a counter that reset every day would hand out
 * the exact same ID on two different days within the same year, which
 * would defeat the entire point of a *unique* ID. No separators (no
 * hyphens) between segments, per the client's spec.
 *
 * Two earlier formats may still be present on already-assigned rows,
 * since a uniqueId never changes once given out:
 *   - "{A|M}{2-digit stream}{8-digit all-time sequence}" (11 chars)
 *   - "{A|M}{2-digit stream}{YYMMDD enrolment date}{3-digit daily
 *     sequence}" (12 chars) — this one briefly shipped to production
 *     before being replaced by the format above; both are 12 chars, so
 *     there's no length-based way to tell them apart after the fact, only
 *     the fact that the current scheme's 3rd/4th digits are always a
 *     valid month/day pair for the old format and are not meaningful
 *     digits of a plain sequence for the new one.
 * Nothing rewrites old IDs; User.uniqueId's VARCHAR(12) already fits every
 * format above without a new migration.
 *
 * STREAM_CODES below is only partially client-confirmed. The client
 * specified Medical=11, Dental=22, Engineering=33, and Others=26 — note
 * that break from the obvious 44/55/66/77 doubling pattern, which is
 * exactly why the remaining four codes are NOT guessed with confidence.
 * Everything marked "UNCONFIRMED" below is a placeholder so the feature
 * can ship and be demoed now; swap in the client's real codes before this
 * is treated as final for any profile that already has one assigned,
 * since — by design — a uniqueId never changes once given out.
 */
export const STREAM_CODES: Record<string, string> = {
  Medical: '11',
  Dental: '22',
  Engineering: '33',
  // UNCONFIRMED — placeholder codes only, pending the client's actual list.
  'Arts & Humanities': '44',
  'Commerce & Business': '55',
  Law: '66',
  Design: '77',
  Others: '26',
};

const FALLBACK_STREAM_CODE = STREAM_CODES.Others;

export function streamCodeFor(stream: string | null | undefined): string {
  if (!stream) return FALLBACK_STREAM_CODE;
  return STREAM_CODES[stream] ?? FALLBACK_STREAM_CODE;
}

/** Two-digit year for `date`, e.g. 2026 -> "26". */
function yy(date: Date): string {
  return (date.getUTCFullYear() % 100).toString().padStart(2, '0');
}

/** The IdSequenceCounter bucket a given prefix+stream+year shares — the
 * counter only resets when the calendar year rolls over, never daily
 * (see the format note above for why a daily reset would produce
 * duplicate IDs once month/day aren't part of the visible ID). */
export function bucketKeyFor(
  prefix: 'A' | 'M',
  streamCode: string,
  enrolledAt: Date,
): string {
  return `${prefix}${streamCode}${yy(enrolledAt)}`;
}

export function buildUniqueId(
  prefix: 'A' | 'M',
  streamCode: string,
  enrolledAt: Date,
  sequence: number,
): string {
  return `${prefix}${streamCode}${yy(enrolledAt)}${sequence.toString().padStart(7, '0')}`;
}
