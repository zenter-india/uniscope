import { University, User, UserProfile } from '@prisma/client';

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
  specialty: string | null;
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
 * callers must filter (isMentorAvailable, pricePerMinuteMinor != null,
 * VERIFIED) at the query level; this is a projection, not a guard. */
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
    specialty: profile?.specialty ?? null,
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
