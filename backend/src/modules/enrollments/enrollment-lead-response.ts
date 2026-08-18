import { EnrollmentLead } from '@prisma/client';

/**
 * Full lead projection — ADMIN surfaces only. This is the one response shape in
 * the codebase that deliberately includes a plaintext phone number (see the
 * EnrollmentLead model docs for why leads store one at all), so it must never
 * be reachable from a public or user-authenticated route. `documentKey` is
 * excluded on purpose: the raw storage path is never handed to a client, the
 * same as VerificationRequest — admins fetch a short-lived signed URL instead.
 */
export interface EnrollmentLeadResponse {
  id: string;
  role: EnrollmentLead['role'];
  status: EnrollmentLead['status'];

  fullName: string;
  phone: string;
  email: string | null;

  dateOfBirth: Date | null;
  gender: string | null;
  state: string | null;
  city: string | null;
  stream: string | null;

  qualification: string | null;
  courseInterested: string | null;
  preferredLanguage: string | null;
  preferredMentorshipTiming: string | null;

  alias: string | null;
  universityId: string | null;
  collegeName: string | null;
  degree: string | null;
  specialization: string | null;
  currentStatus: string | null;
  yearOfStudy: number | null;
  graduationYear: number | null;
  yearInfoPrivate: boolean;
  languages: string[];
  availableDays: string[];

  documentType: EnrollmentLead['documentType'];
  /** Whether a college-ID image was uploaded — the key itself stays server-side.
   * Drives whether the admin UI offers a "View document" action. */
  hasDocument: boolean;

  convertedUserId: string | null;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;

  /** Populated when the row was fetched with the university relation. */
  universityName?: string;
}

export function toEnrollmentLeadResponse(
  lead: EnrollmentLead & { university?: { name: string } | null },
): EnrollmentLeadResponse {
  return {
    id: lead.id,
    role: lead.role,
    status: lead.status,

    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email,

    dateOfBirth: lead.dateOfBirth,
    gender: lead.gender,
    state: lead.state,
    city: lead.city,
    stream: lead.stream,

    qualification: lead.qualification,
    courseInterested: lead.courseInterested,
    preferredLanguage: lead.preferredLanguage,
    preferredMentorshipTiming: lead.preferredMentorshipTiming,

    alias: lead.alias,
    universityId: lead.universityId,
    collegeName: lead.collegeName,
    degree: lead.degree,
    specialization: lead.specialization,
    currentStatus: lead.currentStatus,
    yearOfStudy: lead.yearOfStudy,
    graduationYear: lead.graduationYear,
    yearInfoPrivate: lead.yearInfoPrivate,
    languages: lead.languages,
    availableDays: lead.availableDays,

    documentType: lead.documentType,
    hasDocument: lead.documentKey !== null,

    convertedUserId: lead.convertedUserId,
    adminNote: lead.adminNote,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,

    ...(lead.university && { universityName: lead.university.name }),
  };
}

/**
 * What the public form gets back. Intentionally almost nothing: the submitter
 * already knows what they typed, and echoing a stored record back over an
 * unauthenticated endpoint would turn the form into a way to read leads by
 * guessing ids.
 */
export interface EnrollmentLeadAcknowledgement {
  id: string;
  role: EnrollmentLead['role'];
  status: EnrollmentLead['status'];
}
