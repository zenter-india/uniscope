import { VerificationRequest } from '@prisma/client';
import { decryptRealName } from '../../common/helpers/profile-encryption.helper.js';

export interface VerificationApplicant {
  displayName: string;
  /** Decrypted; null for aspirants and if decryption fails. */
  realName: string | null;
  role: string;
  gender: string | null;
  state: string | null;
  city: string | null;
  stream: string | null;
  qualification: string | null;
  specialization: string | null;
  courseInterested: string | null;
  yearOfStudy: number | null;
  graduationYear: number | null;
  yearInfoPrivate: boolean;
  dateOfBirth: string | null;
  languages: string[];
  availableDays: string[];
  goals: string[];
  bio: string | null;
  specialty: string | null;
  preferredLanguage: string | null;
  preferredMentorshipTiming: string | null;
}

export interface VerificationRequestResponse {
  id: string;
  userId: string;
  universityId: string;
  documentType: VerificationRequest['documentType'];
  status: VerificationRequest['status'];
  reviewNote: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
  /** Admin-queue-only convenience fields — populated when the row was
   * fetched with the user/university relations included (see
   * VerificationService.findQueue). Undefined elsewhere. */
  userDisplayName?: string;
  universityName?: string;
  /** Full applicant detail — only on the admin queue, so a reviewer can
   * see what the person submitted without leaving the queue. */
  applicant?: VerificationApplicant;
}

type QueueProfile = {
  realNameEncrypted: string | null;
  gender: string | null;
  state: string | null;
  city: string | null;
  stream: string | null;
  qualification: string | null;
  specialization: string | null;
  courseInterested: string | null;
  yearOfStudy: number | null;
  graduationYear: number | null;
  yearInfoPrivate: boolean;
  dateOfBirth: Date | null;
  languages: string[];
  availableDays: string[];
  goals: string[];
  bio: string | null;
  specialty: string | null;
  preferredLanguage: string | null;
  preferredMentorshipTiming: string | null;
};

export function toVerificationRequestResponse(
  req: VerificationRequest & {
    user?: { displayName: string; role?: string; profile?: QueueProfile | null };
    university?: { name: string };
  },
): VerificationRequestResponse {
  return {
    id: req.id,
    userId: req.userId,
    universityId: req.universityId,
    documentType: req.documentType,
    status: req.status,
    reviewNote: req.reviewNote,
    submittedAt: req.submittedAt,
    reviewedAt: req.reviewedAt,
    createdAt: req.createdAt,
    ...(req.user && { userDisplayName: req.user.displayName }),
    ...(req.university && { universityName: req.university.name }),
    ...(req.user?.role !== undefined && {
      applicant: toApplicant(req.user as {
        displayName: string;
        role: string;
        profile?: QueueProfile | null;
      }),
    }),
  };
}

function toApplicant(user: {
  displayName: string;
  role: string;
  profile?: QueueProfile | null;
}): VerificationApplicant {
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
    displayName: user.displayName,
    realName,
    role: user.role,
    gender: p?.gender ?? null,
    state: p?.state ?? null,
    city: p?.city ?? null,
    stream: p?.stream ?? null,
    qualification: p?.qualification ?? null,
    specialization: p?.specialization ?? null,
    courseInterested: p?.courseInterested ?? null,
    yearOfStudy: p?.yearOfStudy ?? null,
    graduationYear: p?.graduationYear ?? null,
    yearInfoPrivate: p?.yearInfoPrivate ?? false,
    dateOfBirth: p?.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    languages: p?.languages ?? [],
    availableDays: p?.availableDays ?? [],
    goals: p?.goals ?? [],
    bio: p?.bio ?? null,
    specialty: p?.specialty ?? null,
    preferredLanguage: p?.preferredLanguage ?? null,
    preferredMentorshipTiming: p?.preferredMentorshipTiming ?? null,
  };
}
