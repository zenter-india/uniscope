import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Session, SessionStatus, SessionType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { ChatService } from '../chat/chat.service.js';
import { MentorsService } from '../mentors/mentors.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { ListSessionsDto } from './dto/list-sessions.dto.js';
import { SessionResponse, toSessionResponse } from './session-response.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Statuses that represent an unresolved, still-live booking against a given
 * mentor — used to block an aspirant from spamming a second request at the
 * same mentor while one is already outstanding. */
const ACTIVE_STATUSES: SessionStatus[] = [
  SessionStatus.PENDING,
  SessionStatus.ACCEPTED,
  SessionStatus.RINGING,
  SessionStatus.IN_PROGRESS,
];

/**
 * SessionsService owns the booking lifecycle: request -> accept/reject ->
 * (ring ->) connect -> bill -> end. This module implements the request/
 * respond/cancel legs of the state machine. The connect/bill/end legs
 * (RINGING -> IN_PROGRESS -> COMPLETED) are driven by server-confirmed
 * provider events (Agora webhooks for AUDIO_CALL) and a BullMQ billing
 * clock — deliberately not implemented here; see docs on the call+billing
 * state machine before wiring those in. Billing must NEVER be started by a
 * client request to this service.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mentorsService: MentorsService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * Creates a PENDING booking request. The mentor's current rate is
   * snapshotted onto the session at creation time — later rate changes must
   * never retroactively affect this session.
   */
  async create(
    aspirantId: string,
    dto: CreateSessionDto,
  ): Promise<SessionResponse> {
    if (dto.mentorId === aspirantId) {
      throw new ConflictException('You cannot book a session with yourself');
    }

    // Throws NotFoundException if the mentor isn't eligible (unverified,
    // unavailable, or no rate set) — same check GET /mentors/:id uses.
    const mentor = await this.mentorsService.findById(dto.mentorId);

    const existingActive = await this.prisma.session.findFirst({
      where: {
        aspirantId,
        mentorId: dto.mentorId,
        status: { in: ACTIVE_STATUSES },
      },
    });
    if (existingActive) {
      throw new ConflictException(
        'You already have an active session request with this mentor',
      );
    }

    const session = await this.prisma.session.create({
      data: {
        aspirantId,
        mentorId: dto.mentorId,
        type: dto.type,
        ratePerMinuteMinor: mentor.pricePerMinuteMinor,
      },
    });

    return toSessionResponse(session);
  }

  /** Only the booked mentor may accept, and only while PENDING. */
  async accept(sessionId: string, mentorUserId: string): Promise<SessionResponse> {
    const session = await this.requireSession(sessionId);
    this.requireParty(session, mentorUserId, 'mentor');

    if (session.status !== SessionStatus.PENDING) {
      throw new ConflictException(
        `Cannot accept a session in status ${session.status}`,
      );
    }

    // For CHAT sessions the Stream channel is the messaging surface itself,
    // so it's provisioned right on accept (AUDIO_CALL sessions provision
    // their Agora channel later, at the connect leg).
    const streamChannelId =
      session.type === SessionType.CHAT
        ? await this.chatService.ensureChannelForSession({
            sessionId: session.id,
            aspirantId: session.aspirantId,
            mentorId: session.mentorId,
          })
        : undefined;

    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.ACCEPTED,
        respondedAt: new Date(),
        ...(streamChannelId && { streamChannelId }),
      },
    });

    return toSessionResponse(updated);
  }

  /** Only the booked mentor may reject, and only while PENDING. */
  async reject(sessionId: string, mentorUserId: string): Promise<SessionResponse> {
    const session = await this.requireSession(sessionId);
    this.requireParty(session, mentorUserId, 'mentor');

    if (session.status !== SessionStatus.PENDING) {
      throw new ConflictException(
        `Cannot reject a session in status ${session.status}`,
      );
    }

    const now = new Date();
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.REJECTED,
        respondedAt: now,
        endedAt: now,
        endReason: 'REJECTED',
      },
    });

    return toSessionResponse(updated);
  }

  /** Only the requesting aspirant may cancel, and only before the session
   * has actually started (PENDING or ACCEPTED — not RINGING/IN_PROGRESS). */
  async cancel(sessionId: string, aspirantUserId: string): Promise<SessionResponse> {
    const session = await this.requireSession(sessionId);
    this.requireParty(session, aspirantUserId, 'aspirant');

    if (
      session.status !== SessionStatus.PENDING &&
      session.status !== SessionStatus.ACCEPTED
    ) {
      throw new ConflictException(
        `Cannot cancel a session in status ${session.status}`,
      );
    }

    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.CANCELLED,
        endedAt: new Date(),
        endReason: 'CANCELLED',
      },
    });

    return toSessionResponse(updated);
  }

  /** Lists sessions where the current user is a party — as aspirant,
   * mentor, or both (default), optionally filtered by status. */
  async findAll(
    userId: string,
    query: ListSessionsDto,
  ): Promise<{ data: SessionResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const partyFilter: Prisma.SessionWhereInput =
      query.as === 'aspirant'
        ? { aspirantId: userId }
        : query.as === 'mentor'
          ? { mentorId: userId }
          : { OR: [{ aspirantId: userId }, { mentorId: userId }] };

    const where: Prisma.SessionWhereInput = {
      ...partyFilter,
      ...(query.status && { status: query.status }),
    };

    const rows = await this.prisma.session.findMany({
      where,
      orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const rowsPage = hasMore ? rows.slice(0, take) : rows;
    const data = rowsPage.map(toSessionResponse);
    const nextCursor = hasMore ? rowsPage[rowsPage.length - 1].id : null;

    return { data, nextCursor };
  }

  /** Returns 404 (not 403) for a session the user isn't party to — avoids
   * confirming to an unrelated user that a given session id even exists. */
  async findById(sessionId: string, userId: string): Promise<SessionResponse> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [{ aspirantId: userId }, { mentorId: userId }],
      },
    });

    if (!session) {
      throw new NotFoundException(`Session '${sessionId}' not found`);
    }

    return toSessionResponse(session);
  }

  private async requireSession(sessionId: string): Promise<Session> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException(`Session '${sessionId}' not found`);
    }
    return session;
  }

  private requireParty(
    session: Session,
    userId: string,
    party: 'aspirant' | 'mentor',
  ): void {
    const expectedId = party === 'aspirant' ? session.aspirantId : session.mentorId;
    if (expectedId !== userId) {
      throw new ForbiddenException(
        `Only the session's ${party} may perform this action`,
      );
    }
  }
}
