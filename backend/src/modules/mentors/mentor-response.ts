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
  avatarKey: string | null;
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
  createdAt: Date;
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
): MentorResponse {
  const profile = user.profile;
  return {
    id: user.id,
    displayName: user.displayName,
    role: user.role,
    avatarKey: profile?.avatarKey ?? null,
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
    createdAt: user.createdAt,
  };
}
