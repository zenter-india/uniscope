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
      profile: { select: { avatarKey: true, updatedAt: true } },
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
        },
      },
    },
  },
} as const;

type SessionParty = {
  displayName: string;
  uniqueId: string | null;
  profile: { avatarKey: string | null; updatedAt: Date } | null;
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
      }
    | null;
};

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
}

export function toSessionResponse(
  session: SessionWithNames,
  resolveAvatarUrl: AvatarUrlResolver,
): SessionResponse {
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
    mentorAvailableDays: session.mentor.profile?.availableDays ?? [],
  };
}
