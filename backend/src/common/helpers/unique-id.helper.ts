/**
 * Client-facing registration numbers for aspirant/mentor profiles.
 *
 * Format: "{A|M}{2-digit stream code}{8-digit sequence}" — 11 characters,
 * e.g. "A1100000001" (aspirant #1, Medical) or "M3300000047" (mentor #47,
 * Engineering). The prefix comes from UserRole, the stream code from the
 * user's UserProfile.stream, and the sequence from IdSequenceCounter (one
 * counter per prefix+code bucket, claimed atomically — see
 * UsersService.ensureUniqueId).
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

export function buildUniqueId(
  prefix: 'A' | 'M',
  streamCode: string,
  sequence: number,
): string {
  return `${prefix}${streamCode}${sequence.toString().padStart(8, '0')}`;
}
