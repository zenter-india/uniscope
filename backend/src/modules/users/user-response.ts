import { University, User, UserProfile } from '@prisma/client';
import { isCallAvailable } from '../mentors/availability.js';

/**
 * Client-safe view of a User. Built with an explicit allowlist so that
 * sensitive columns (phoneHash, refreshTokenHash) and internal bookkeeping
 * (deletedAt) are never serialized to API responses, and any future column
 * added to the User model stays private until deliberately exposed here.
 */
export interface PublicUser {
  id: string;
  displayName: string;
  role: User['role'];
  verificationStatus: User['verificationStatus'];
  isActive: boolean;
  isBanned: boolean;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Populated only when the caller loaded the profile relation (self
   * lookups) — undefined elsewhere. */
  bio?: string | null;
  specialty?: string | null;
  languages?: string[];
  availableDays?: string[];
  isMentorAvailable?: boolean;
  university?: { id: string; name: string; slug: string } | null;
  gender?: string | null;
  state?: string | null;
  city?: string | null;
  qualification?: string | null;
  stream?: string | null;
  yearOfStudy?: number | null;
  graduationYear?: number | null;
  goals?: string[];
  dateOfBirth?: string | null;
  courseInterested?: string | null;
  preferredLanguage?: string | null;
  preferredMentorshipTiming?: string | null;
  /** Public URL of the rendered avatar SVG, or null if the user has
   * none yet. Carries a cache-busting `v` param derived from the
   * profile's updatedAt. */
  avatarUrl?: string | null;
}

type UserWithProfile = User & {
  profile?: (UserProfile & { university?: University | null }) | null;
};

export function toPublicUser(
  user: UserWithProfile,
  avatarUrl?: string | null,
): PublicUser {
  return {
    id: user.id,
    displayName: user.displayName,
    role: user.role,
    verificationStatus: user.verificationStatus,
    isActive: user.isActive,
    isBanned: user.isBanned,
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...(user.profile !== undefined && {
      avatarUrl: avatarUrl ?? null,
      bio: user.profile?.bio ?? null,
      specialty: user.profile?.specialty ?? null,
      languages: user.profile?.languages ?? [],
      availableDays: user.profile?.availableDays ?? [],
      // Deliberately the expiry-aware value, not the raw column: the mentor's
      // own switch must read the same as what students see, or they'd believe
      // they're bookable while the listing says otherwise.
      isMentorAvailable: isCallAvailable(user.profile),
      university: user.profile?.university
        ? {
            id: user.profile.university.id,
            name: user.profile.university.name,
            slug: user.profile.university.slug,
          }
        : null,
      gender: user.profile?.gender ?? null,
      state: user.profile?.state ?? null,
      city: user.profile?.city ?? null,
      qualification: user.profile?.qualification ?? null,
      stream: user.profile?.stream ?? null,
      yearOfStudy: user.profile?.yearOfStudy ?? null,
      graduationYear: user.profile?.graduationYear ?? null,
      goals: user.profile?.goals ?? [],
      dateOfBirth: user.profile?.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      courseInterested: user.profile?.courseInterested ?? null,
      preferredLanguage: user.profile?.preferredLanguage ?? null,
      preferredMentorshipTiming: user.profile?.preferredMentorshipTiming ?? null,
    }),
  };
}
