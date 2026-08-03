import { Session } from '@prisma/client';

/** Reusable Prisma `include` for fetching the display names + avatar source
 * fields needed to render "who is this session/chat with" (including their
 * avatar) in the client — pass this to any query whose result feeds
 * toSessionResponse. */
export const SESSION_WITH_NAMES_INCLUDE = {
  aspirant: {
    select: {
      displayName: true,
      profile: { select: { avatarKey: true, updatedAt: true } },
    },
  },
  mentor: {
    select: {
      displayName: true,
      profile: { select: { avatarKey: true, updatedAt: true } },
    },
  },
} as const;

type SessionParty = {
  displayName: string;
  profile: { avatarKey: string | null; updatedAt: Date } | null;
};

type SessionWithNames = Session & {
  aspirant: SessionParty;
  mentor: SessionParty;
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
  aspirantJoinedAt: Date | null;
  mentorJoinedAt: Date | null;
  createdAt: Date;
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
    aspirantJoinedAt: session.aspirantJoinedAt,
    mentorJoinedAt: session.mentorJoinedAt,
    createdAt: session.createdAt,
  };
}
