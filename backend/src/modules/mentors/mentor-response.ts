import { University, User, UserProfile } from '@prisma/client';
import { isCallAvailable } from './availability.js';

/**
 * Public-safe mentor projection. Deliberately excludes phoneHash,
 * realNameEncrypted, refreshTokenHash, and every other identity field —
 * mentors are anonymous by product design (see docs/decisions/*).
 */
export interface MentorResponse {
  id: string;
  displayName: string;
  role: User['role'];
  /** Public URL of the rendered avatar SVG. `avatarKey` (the raw
   * config) is deliberately NOT exposed — it's private styling state,
   * not something other users need. */
  avatarUrl: string | null;
  /** Whether this mentor is currently accepting call bookings — their own
   * stated intent, auto-expired after 24h (see isCallAvailable). This is NOT
   * real-time presence and must never be labelled "online" in the UI. Does
   * not affect discoverability: an unavailable mentor is still listed and
   * still reachable by chat. */
  isAvailable: boolean;
  /** Days the mentor says they're generally free, e.g. ["Monday","Thursday"].
   * Purely advisory — booking is never blocked by it. */
  availableDays: string[];
  specialty: string | null;
  /** Mentor's college field of study (Medical/Engineering/Law/etc) — the
   * primary attribute aspirants filter/search mentors by, now that the
   * separate guidance-area step is gone from the mentor wizard. */
  stream: string | null;
  bio: string | null;
  languages: string[];
  yearOfStudy: number | null;
  graduationYear: number | null;
  pricePerMinuteMinor: number;
  university: { id: string; name: string; slug: string } | null;
  /** null until the mentor has at least one review. */
  rating: number | null;
  reviewCount: number;
  /** Public track-record stats, derived from COMPLETED sessions. Only set
   * on the single-mentor detail response — the list endpoint skips them
   * rather than run two aggregates per row. Note there is deliberately no
   * response-rate or response-time stat: nothing in the schema records
   * message timestamps, so those can't be computed honestly today. */
  studentsHelped: number | null;
  minutesMentored: number | null;
  createdAt: Date;
}

export interface MentorTrackRecord {
  studentsHelped: number;
  minutesMentored: number;
}

type MentorRow = User & {
  profile:
    | (UserProfile & { university: University | null })
    | null;
};

/** Throws if called on a row whose mentor invariants aren't satisfied —
 * callers must filter (VERIFIED, active, not banned) at the query level;
 * this is a projection, not a guard. */
export function toMentorResponse(
  user: MentorRow,
  rating?: { average: number | null; count: number },
  trackRecord?: MentorTrackRecord,
  avatarUrl?: string | null,
): MentorResponse {
  const profile = user.profile;
  return {
    id: user.id,
    displayName: user.displayName,
    role: user.role,
    avatarUrl: avatarUrl ?? null,
    isAvailable: isCallAvailable(profile),
    availableDays: profile?.availableDays ?? [],
    specialty: profile?.specialty ?? null,
    stream: profile?.stream ?? null,
    bio: profile?.bio ?? null,
    languages: profile?.languages ?? [],
    yearOfStudy: profile?.yearOfStudy ?? null,
    graduationYear: profile?.graduationYear ?? null,
    pricePerMinuteMinor: profile?.pricePerMinuteMinor ?? 0,
    university: profile?.university
      ? {
          id: profile.university.id,
          name: profile.university.name,
          slug: profile.university.slug,
        }
      : null,
    rating: rating?.average ?? null,
    reviewCount: rating?.count ?? 0,
    studentsHelped: trackRecord?.studentsHelped ?? null,
    minutesMentored: trackRecord?.minutesMentored ?? null,
    createdAt: user.createdAt,
  };
}
