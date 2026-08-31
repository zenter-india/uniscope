/**
 * Client-facing registration numbers for aspirant/mentor profiles.
 *
 * Format: "{A|M}{2-digit stream code}{6-digit enrolment date, YYMMDD}
 * {3-digit daily sequence}" — 12 characters, e.g. "M11260819001" (mentor,
 * Medical, enrolled 19 Aug 2026, 1st in that stream that day) or
 * "A22260819047" (aspirant, Dental, same day, 47th). The date alone can't
 * guarantee uniqueness (any number of people can join the same stream on
 * the same day), so the trailing sequence is scoped to
 * prefix+streamCode+date and claimed atomically — see
 * UsersService.ensureUniqueId and IdSequenceCounter. No separators (no
 * hyphens) between segments, per the client's spec.
 *
 * Previous format (still present on any already-assigned row, since a
 * uniqueId never changes once given out) was "{A|M}{2-digit stream}
 * {8-digit all-time sequence}" — 11 characters. Both lengths coexist in
 * the uniqueId column (VARCHAR(12) fits either); nothing rewrites old IDs.
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

/** YYMMDD for `date`, e.g. 2026-08-19 -> "260819". Two-digit year per the
 * client's spec (not Y2.1K-safe, but matches what was asked for). */
function yymmdd(date: Date): string {
  const yy = (date.getUTCFullYear() % 100).toString().padStart(2, '0');
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = date.getUTCDate().toString().padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** The IdSequenceCounter bucket a given prefix+stream+day shares — the
 * counter resets to 1 each new day, so the same stream can safely hand
 * out 001-999 IDs per calendar day without colliding. */
export function bucketKeyFor(
  prefix: 'A' | 'M',
  streamCode: string,
  enrolledAt: Date,
): string {
  return `${prefix}${streamCode}${yymmdd(enrolledAt)}`;
}

export function buildUniqueId(
  prefix: 'A' | 'M',
  streamCode: string,
  enrolledAt: Date,
  sequence: number,
): string {
  return `${prefix}${streamCode}${yymmdd(enrolledAt)}${sequence.toString().padStart(3, '0')}`;
}
