import {
  University,
  User,
  UserProfile,
  VerificationRequest,
  Wallet,
} from '@prisma/client';
import { decryptRealName } from '../../common/helpers/profile-encryption.helper.js';
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
  specialization?: string | null;
  stream?: string | null;
  yearOfStudy?: number | null;
  graduationYear?: number | null;
  yearInfoPrivate?: boolean;
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

/**
 * Full, admin-only view of a single user — deliberately exposes far more than
 * {@link PublicUser}: every value the person entered during signup and
 * onboarding, their (decrypted) real name, wallet balance, verification
 * history and activity counters. ADMIN routes only — never a user-facing
 * projection. The raw storage keys for verification documents are still
 * withheld (admins fetch a signed URL via `/verification/:id/document-url`).
 */
export interface AdminUserDetail {
  id: string;
  displayName: string;
  /** Decrypted from `UserProfile.realNameEncrypted`. Null for aspirants (who
   * never set one) and if decryption fails (e.g. key rotated). */
  realName: string | null;
  role: User['role'];
  verificationStatus: User['verificationStatus'];
  isActive: boolean;
  isBanned: boolean;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  avatarUrl: string | null;

  profile: {
    dateOfBirth: string | null;
    gender: string | null;
    state: string | null;
    city: string | null;
    university: { id: string; name: string; slug: string } | null;
    qualification: string | null;
    stream: string | null;
    specialization: string | null;
    courseInterested: string | null;
    yearOfStudy: number | null;
    graduationYear: number | null;
    yearInfoPrivate: boolean;
    goals: string[];
    preferredLanguage: string | null;
    preferredMentorshipTiming: string | null;
    bio: string | null;
    specialty: string | null;
    languages: string[];
    availableDays: string[];
    /** Expiry-aware value, same as everywhere else (see isCallAvailable). */
    isMentorAvailable: boolean;
    /** Raw column — lets an admin see a toggle that has since gone stale. */
    isMentorAvailableRaw: boolean;
    availabilitySetAt: Date | null;
    pricePerMinuteMinor: number | null;
    freeChatsRemaining: number;
    freeCallSecondsRemaining: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;

  wallet: { balanceMinor: number } | null;

  verificationRequests: Array<{
    id: string;
    documentType: string;
    status: string;
    reviewNote: string | null;
    reviewerName: string | null;
    universityName: string | null;
    hasDocument: boolean;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    createdAt: Date;
  }>;

  activity: {
    sessionsAsAspirant: number;
    sessionsAsMentor: number;
    reportsFiled: number;
    reportsAgainst: number;
    mentorReviewsReceived: number;
    universityReviewsWritten: number;
  };
}

type AdminUserRow = User & {
  profile?: (UserProfile & { university?: University | null }) | null;
  wallet?: Wallet | null;
  verificationRequests?: Array<
    VerificationRequest & {
      university?: { name: string } | null;
      reviewer?: { displayName: string } | null;
    }
  >;
};

export function toAdminUserDetail(
  user: AdminUserRow,
  activity: AdminUserDetail['activity'],
  avatarUrl?: string | null,
): AdminUserDetail {
  const p = user.profile ?? null;

  let realName: string | null = null;
  if (p?.realNameEncrypted) {
    try {
      realName = decryptRealName(p.realNameEncrypted);
    } catch {
      realName = null;
    }
  }

  return {
    id: user.id,
    displayName: user.displayName,
    realName,
    role: user.role,
    verificationStatus: user.verificationStatus,
    isActive: user.isActive,
    isBanned: user.isBanned,
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
    avatarUrl: avatarUrl ?? null,
    profile: p
      ? {
          dateOfBirth: p.dateOfBirth?.toISOString().slice(0, 10) ?? null,
          gender: p.gender ?? null,
          state: p.state ?? null,
          city: p.city ?? null,
          university: p.university
            ? { id: p.university.id, name: p.university.name, slug: p.university.slug }
            : null,
          qualification: p.qualification ?? null,
          stream: p.stream ?? null,
          specialization: p.specialization ?? null,
          courseInterested: p.courseInterested ?? null,
          yearOfStudy: p.yearOfStudy ?? null,
          graduationYear: p.graduationYear ?? null,
          yearInfoPrivate: p.yearInfoPrivate,
          goals: p.goals ?? [],
          preferredLanguage: p.preferredLanguage ?? null,
          preferredMentorshipTiming: p.preferredMentorshipTiming ?? null,
          bio: p.bio ?? null,
          specialty: p.specialty ?? null,
          languages: p.languages ?? [],
          availableDays: p.availableDays ?? [],
          isMentorAvailable: isCallAvailable(p),
          isMentorAvailableRaw: p.isMentorAvailable,
          availabilitySetAt: p.availabilitySetAt,
          pricePerMinuteMinor: p.pricePerMinuteMinor ?? null,
          freeChatsRemaining: p.freeChatsRemaining,
          freeCallSecondsRemaining: p.freeCallSecondsRemaining,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }
      : null,
    wallet: user.wallet ? { balanceMinor: user.wallet.balanceMinor } : null,
    verificationRequests: (user.verificationRequests ?? []).map((r) => ({
      id: r.id,
      documentType: r.documentType,
      status: r.status,
      reviewNote: r.reviewNote,
      reviewerName: r.reviewer?.displayName ?? null,
      universityName: r.university?.name ?? null,
      hasDocument: r.documentKey !== null && r.documentKey !== '',
      submittedAt: r.submittedAt,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
    })),
    activity,
  };
}

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
      specialization: user.profile?.specialization ?? null,
      stream: user.profile?.stream ?? null,
      yearOfStudy: user.profile?.yearOfStudy ?? null,
      graduationYear: user.profile?.graduationYear ?? null,
      yearInfoPrivate: user.profile?.yearInfoPrivate ?? false,
      goals: user.profile?.goals ?? [],
      dateOfBirth: user.profile?.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      courseInterested: user.profile?.courseInterested ?? null,
      preferredLanguage: user.profile?.preferredLanguage ?? null,
      preferredMentorshipTiming: user.profile?.preferredMentorshipTiming ?? null,
    }),
  };
}
