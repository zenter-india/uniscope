import { Session } from '@prisma/client';

import { isCallAvailable } from '../mentors/availability.js';

/** Reusable Prisma `include` for fetching the display names + avatar source
 * fields needed to render "who is this session/chat with" (including their
 * avatar) in the client — pass this to any query whose result feeds
 * toSessionResponse. The mentor side additionally pulls the two
 * availability columns isCallAvailable() reads, so every session response
 * can carry an expiry-aware mentorIsAvailable (see toSessionResponse). */
export const SESSION_WITH_NAMES_INCLUDE = {
  aspirant: {
    select: {
      displayName: true,
      uniqueId: true,
      profile: {
        select: {
          avatarKey: true,
          updatedAt: true,
          // Feeds the in-call context card the mentor sees about the
          // student: "Aspirant · <stream> · <qualification> · Target: <course>".
          stream: true,
          qualification: true,
          courseInterested: true,
        },
      },
    },
  },
  mentor: {
    select: {
      displayName: true,
      uniqueId: true,
      profile: {
        select: {
          avatarKey: true,
          updatedAt: true,
          isMentorAvailable: true,
          availabilitySetAt: true,
          // The mentor's stated free-time windows ("Morning (6 AM - 12 PM)"
          // etc). Feeds the "When?" quick-picks in the call-request sheet so
          // the Sessions list can offer them without a second fetch.
          availableDays: true,
          // Feeds the in-call context card the aspirant sees about the
          // mentor: "<College> · ★<rating> · <specialty>".
          specialty: true,
          specialization: true,
          stream: true,
          university: { select: { name: true } },
        },
      },
    },
  },
} as const;

type SessionParty = {
  displayName: string;
  uniqueId: string | null;
  profile:
    | {
        avatarKey: string | null;
        updatedAt: Date;
        stream: string | null;
        qualification: string | null;
        courseInterested: string | null;
      }
    | null;
};

type MentorSessionParty = {
  displayName: string;
  uniqueId: string | null;
  profile:
    | {
        avatarKey: string | null;
        updatedAt: Date;
        isMentorAvailable: boolean;
        availabilitySetAt: Date | null;
        availableDays: string[];
        specialty: string | null;
        specialization: string | null;
        stream: string | null;
        university: { name: string } | null;
      }
    | null;
};

/** Aggregate rating for the in-call context card — optional because only
 * the single-session path (toResponseById) computes it. */
export type MentorRatingLite = { average: number | null; count: number };

type SessionWithNames = Session & {
  aspirant: SessionParty;
  mentor: MentorSessionParty;
};

/** Resolves a party's avatar URL — injected by the caller (SessionsService
 * has AvatarService; this file stays a pure/DI-free response mapper). */
export type AvatarUrlResolver = (
  userId: string,
  avatarKey: string | null,
  updatedAt: Date,
) => string | null;

/** Session rows have no sensitive fields of their own, but we still project
 * explicitly (rather than returning the Prisma row directly) so that any
 * future column addition stays private until deliberately exposed here. */
export interface SessionResponse {
  id: string;
  aspirantId: string;
  mentorId: string;
  aspirantName: string;
  mentorName: string;
  /** Public registration number (e.g. "A1134500001" / "M3300000047") — see
   * unique-id.helper.ts. Null until the party's profile.stream is known.
   * Shown to the counterparty in the chat/session header instead of a
   * tappable name, per product decision — never the internal DB id. */
  aspirantUniqueId: string | null;
  mentorUniqueId: string | null;
  aspirantAvatarUrl: string | null;
  mentorAvatarUrl: string | null;
  type: Session['type'];
  status: Session['status'];
  ratePerMinuteMinor: number;
  requestedAt: Date;
  respondedAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  billedMinutes: number;
  totalCostMinor: number;
  endReason: string | null;
  callSlotMinutes: number | null;
  /** AUDIO_CALL only: the time the aspirant asked to connect, from the
   * "When?" step. Null = Instant. Advisory — nothing is reserved; the
   * mentor sees it on the request and still drives the connect. */
  requestedFor: Date | null;
  /** AUDIO_CALL only: an optional second preferred time — the aspirant may
   * offer two options. Null unless requestedFor is also set. */
  requestedForAlt: Date | null;
  aspirantJoinedAt: Date | null;
  mentorJoinedAt: Date | null;
  createdAt: Date;
  /** Expiry-aware "can this mentor be booked for a call right now" — the
   * same isCallAvailable() gate every other surface uses (mentor list,
   * mentor detail, the mentor's own profile switch). Lets the aspirant's
   * Sessions list show a live call-availability state per mentor without a
   * second request. */
  mentorIsAvailable: boolean;
  /** The mentor's stated free-time windows (e.g. ["Morning (6 AM - 12 PM)",
   * "Evening (4 PM - 8 PM)"]) — surfaced so the call-request sheet's
   * "When?" step can offer them as quick-picks straight from a session row. */
  mentorAvailableDays: string[];
  // ── In-call context card ─────────────────────────────────────────────
  /** Mentor's college (from profile.universityId). Aspirant sees this. */
  mentorCollege: string | null;
  /** Mentor's specialty/specialization, else their stream. Aspirant sees this. */
  mentorSpecialty: string | null;
  /** Mentor's average rating (1–5) and review count. `mentorRating` is null
   * with no reviews. Only populated on the single-session path. */
  mentorRating: number | null;
  mentorReviewCount: number;
  /** Aspirant's school stream / qualification / target course. Mentor sees these. */
  aspirantStream: string | null;
  aspirantQualification: string | null;
  aspirantCourse: string | null;
}

export function toSessionResponse(
  session: SessionWithNames,
  resolveAvatarUrl: AvatarUrlResolver,
  mentorRating?: MentorRatingLite,
): SessionResponse {
  const mp = session.mentor.profile;
  const ap = session.aspirant.profile;
  return {
    id: session.id,
    aspirantId: session.aspirantId,
    mentorId: session.mentorId,
    aspirantName: session.aspirant.displayName,
    mentorName: session.mentor.displayName,
    aspirantUniqueId: session.aspirant.uniqueId,
    mentorUniqueId: session.mentor.uniqueId,
    aspirantAvatarUrl: session.aspirant.profile
      ? resolveAvatarUrl(
          session.aspirantId,
          session.aspirant.profile.avatarKey,
          session.aspirant.profile.updatedAt,
        )
      : null,
    mentorAvatarUrl: session.mentor.profile
      ? resolveAvatarUrl(
          session.mentorId,
          session.mentor.profile.avatarKey,
          session.mentor.profile.updatedAt,
        )
      : null,
    type: session.type,
    status: session.status,
    ratePerMinuteMinor: session.ratePerMinuteMinor,
    requestedAt: session.requestedAt,
    respondedAt: session.respondedAt,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    billedMinutes: session.billedMinutes,
    totalCostMinor: session.totalCostMinor,
    endReason: session.endReason,
    callSlotMinutes: session.callSlotMinutes,
    requestedFor: session.requestedFor,
    requestedForAlt: session.requestedForAlt,
    aspirantJoinedAt: session.aspirantJoinedAt,
    mentorJoinedAt: session.mentorJoinedAt,
    createdAt: session.createdAt,
    mentorIsAvailable: isCallAvailable(session.mentor.profile),
    mentorAvailableDays: mp?.availableDays ?? [],
    mentorCollege: mp?.university?.name ?? null,
    mentorSpecialty: mp?.specialty ?? mp?.specialization ?? mp?.stream ?? null,
    mentorRating:
      mentorRating && mentorRating.average != null
        ? Math.round(mentorRating.average * 10) / 10
        : null,
    mentorReviewCount: mentorRating?.count ?? 0,
    aspirantStream: ap?.stream ?? null,
    aspirantQualification: ap?.qualification ?? null,
    aspirantCourse: ap?.courseInterested ?? null,
  };
}
