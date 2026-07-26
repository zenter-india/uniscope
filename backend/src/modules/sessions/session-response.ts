import { Session } from '@prisma/client';

/** Reusable Prisma `include` for fetching the display names needed to
 * render "who is this session/chat with" in the client — pass this to any
 * query whose result feeds toSessionResponse. */
export const SESSION_WITH_NAMES_INCLUDE = {
  aspirant: { select: { displayName: true } },
  mentor: { select: { displayName: true } },
} as const;

type SessionWithNames = Session & {
  aspirant: { displayName: string };
  mentor: { displayName: string };
};

/** Session rows have no sensitive fields of their own, but we still project
 * explicitly (rather than returning the Prisma row directly) so that any
 * future column addition stays private until deliberately exposed here. */
export interface SessionResponse {
  id: string;
  aspirantId: string;
  mentorId: string;
  aspirantName: string;
  mentorName: string;
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

export function toSessionResponse(session: SessionWithNames): SessionResponse {
  return {
    id: session.id,
    aspirantId: session.aspirantId,
    mentorId: session.mentorId,
    aspirantName: session.aspirant.displayName,
    mentorName: session.mentor.displayName,
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
