import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HoldStatus,
  LedgerEntryType,
  Prisma,
  Session,
  SessionStatus,
  SessionType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { AgoraService } from '../agora/agora.service.js';
import { ChatService } from '../chat/chat.service.js';
import { MentorsService } from '../mentors/mentors.service.js';
import { MENTOR_RATE_PER_MINUTE_MINOR, WalletService } from '../wallet/wallet.service.js';
import { CALL_SLOT_MINUTES, CreateSessionDto } from './dto/create-session.dto.js';
import { ListSessionsDto } from './dto/list-sessions.dto.js';
import { SessionResponse, toSessionResponse } from './session-response.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Statuses a call may be joined/connected from. */
const JOINABLE_STATUSES: SessionStatus[] = [SessionStatus.ACCEPTED, SessionStatus.RINGING];

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
    private readonly walletService: WalletService,
    private readonly agoraService: AgoraService,
  ) {}

  /**
   * Creates a PENDING booking request. The mentor's current rate is
   * snapshotted onto the session at creation time — later rate changes must
   * never retroactively affect this session.
   *
   * AUDIO_CALL is a fixed pre-paid slot (5/10/20 min, see CreateSessionDto):
   * covered by the aspirant's free-call-minutes tier if there's enough left,
   * otherwise a WalletHold for the slot cost is placed here at BOOKING time
   * (so the mentor never accepts a request the aspirant can't afford) — the
   * hold is only converted into an actual debit once the call server-
   * confirms a connection (Agora webhook, not implemented here yet).
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

    const isAudioCall = dto.type === SessionType.AUDIO_CALL;
    const slotMinutes = dto.slotMinutes ?? 0;
    const slotSeconds = slotMinutes * 60;
    const slotCostMinor = slotMinutes * MENTOR_RATE_PER_MINUTE_MINOR;

    let isFreeSlot = false;
    if (isAudioCall) {
      const profile = await this.prisma.userProfile.findUniqueOrThrow({
        where: { userId: aspirantId },
      });
      isFreeSlot = profile.freeCallSecondsRemaining >= slotSeconds;
    }

    const session = await this.prisma.session.create({
      data: {
        aspirantId,
        mentorId: dto.mentorId,
        type: dto.type,
        ratePerMinuteMinor: isAudioCall ? MENTOR_RATE_PER_MINUTE_MINOR : mentor.pricePerMinuteMinor,
        ...(isAudioCall && { callSlotMinutes: slotMinutes }),
      },
    });

    if (isAudioCall && !isFreeSlot) {
      const aspirantWallet = await this.prisma.wallet.findUniqueOrThrow({
        where: { userId: aspirantId },
      });
      try {
        await this.walletService.placeHold({
          walletId: aspirantWallet.id,
          sessionId: session.id,
          amountMinor: slotCostMinor,
        });
      } catch (err) {
        // Insufficient balance — undo the session row rather than leaving an
        // orphaned PENDING request the mentor could still see and accept.
        await this.prisma.session.delete({ where: { id: session.id } });
        throw err;
      }
    }

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

    await this.releaseHoldsForSession(sessionId);

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

    await this.releaseHoldsForSession(sessionId);

    return toSessionResponse(updated);
  }

  /**
   * Issues an Agora RTC token for an AUDIO_CALL session. Lazily provisions
   * agoraChannelName on first request (mirrors ChatService's
   * ensureChannelForSession pattern) — a party can call this repeatedly to
   * refresh their token.
   */
  async getCallCredentials(
    sessionId: string,
    userId: string,
  ): Promise<{ appId: string; channelName: string; token: string; uid: string }> {
    const session = await this.requireSessionForParty(sessionId, userId);

    if (session.type !== SessionType.AUDIO_CALL) {
      throw new ForbiddenException('This session is not an audio call session');
    }
    if (!JOINABLE_STATUSES.includes(session.status) && session.status !== SessionStatus.IN_PROGRESS) {
      throw new ConflictException(`Cannot join a call in status ${session.status}`);
    }

    let channelName = session.agoraChannelName;
    if (!channelName) {
      channelName = `call-${session.id}`;
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { agoraChannelName: channelName },
      });
    }

    return {
      appId: this.agoraService.getAppId(),
      channelName,
      token: this.agoraService.generateRtcToken(channelName, userId),
      uid: userId,
    };
  }

  /**
   * Dual-client connect confirmation (interim measure — see the
   * aspirantJoinedAt/mentorJoinedAt schema comment for why this isn't a
   * real server-side signal yet). Records the CALLING party's own join;
   * once BOTH parties have confirmed, transitions the session to
   * IN_PROGRESS and settles billing exactly once — consuming the booking
   * hold if this was a paid slot, or decrementing the free-call-minutes
   * tier if it wasn't.
   */
  async confirmJoined(sessionId: string, userId: string): Promise<SessionResponse> {
    const session = await this.requireSessionForParty(sessionId, userId);

    if (session.type !== SessionType.AUDIO_CALL) {
      throw new ForbiddenException('This session is not an audio call session');
    }
    if (!JOINABLE_STATUSES.includes(session.status)) {
      throw new ConflictException(`Cannot confirm join for a call in status ${session.status}`);
    }

    const isAspirant = session.aspirantId === userId;
    const now = new Date();
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: isAspirant ? { aspirantJoinedAt: now } : { mentorJoinedAt: now },
    });

    const bothJoined = updated.aspirantJoinedAt && updated.mentorJoinedAt;
    if (!bothJoined) {
      return toSessionResponse(updated);
    }

    // Both sides confirmed — settle billing for the originally booked slot
    // exactly once. Guard on status still being pre-IN_PROGRESS in the same
    // update to make the transition itself idempotent against a race
    // between the two confirmJoined calls.
    const settled = await this.prisma.session.updateMany({
      where: { id: sessionId, status: { in: JOINABLE_STATUSES } },
      data: {
        status: SessionStatus.IN_PROGRESS,
        startedAt: now,
        billedMinutes: updated.callSlotMinutes ?? 0,
      },
    });

    if (settled.count === 0) {
      // Another concurrent call already made this transition — no-op.
      return toSessionResponse(await this.requireSession(sessionId));
    }

    const slotMinutes = updated.callSlotMinutes ?? 0;
    const slotCostMinor = slotMinutes * MENTOR_RATE_PER_MINUTE_MINOR;
    const hold = await this.prisma.walletHold.findFirst({
      where: { sessionId, status: HoldStatus.ACTIVE },
    });

    if (hold) {
      const mentorWallet = await this.prisma.wallet.findUniqueOrThrow({
        where: { userId: session.mentorId },
      });
      await this.walletService.consumeHoldAndBill({
        holdId: hold.id,
        mentorWalletId: mentorWallet.id,
        sessionId,
        note: `AUDIO_CALL ${slotMinutes}-min slot`,
      });
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { totalCostMinor: slotCostMinor },
      });
    } else {
      // Free-tier slot — decrement the aspirant's remaining free minutes,
      // never below 0.
      await this.prisma.userProfile.updateMany({
        where: { userId: session.aspirantId },
        data: { freeCallSecondsRemaining: { decrement: slotMinutes * 60 } },
      });
      await this.prisma.userProfile.updateMany({
        where: { userId: session.aspirantId, freeCallSecondsRemaining: { lt: 0 } },
        data: { freeCallSecondsRemaining: 0 },
      });
    }

    return toSessionResponse(await this.requireSession(sessionId));
  }

  /**
   * "Continue for another 5 min" — same debit/credit mechanism as the
   * original booking, but billed immediately (no hold step) since the call
   * is already IN_PROGRESS and both parties are already present. Only the
   * aspirant can trigger this (it costs them Uniminutes).
   */
  async extendCall(sessionId: string, aspirantUserId: string): Promise<SessionResponse> {
    const session = await this.requireSession(sessionId);
    this.requireParty(session, aspirantUserId, 'aspirant');

    if (session.type !== SessionType.AUDIO_CALL) {
      throw new ForbiddenException('This session is not an audio call session');
    }
    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new ConflictException(`Cannot extend a call in status ${session.status}`);
    }

    const extensionMinutes = CALL_SLOT_MINUTES[0]; // fixed +5 min, see product decision
    const extensionCostMinor = extensionMinutes * MENTOR_RATE_PER_MINUTE_MINOR;

    const [aspirantWallet, mentorWallet] = await Promise.all([
      this.prisma.wallet.findUniqueOrThrow({ where: { userId: session.aspirantId } }),
      this.prisma.wallet.findUniqueOrThrow({ where: { userId: session.mentorId } }),
    ]);

    const available = await this.walletService.getAvailableBalanceMinor(aspirantWallet.id);
    if (available < extensionCostMinor) {
      throw new BadRequestException('Insufficient balance — top up to continue the call');
    }

    // Direct debit/credit (no hold): the call is already connected, so
    // there's nothing to reserve against — this is the same idempotent
    // ledger write applyLedgerEntry always uses, keyed per-extension.
    const extensionKey = `${sessionId}:${session.billedMinutes + extensionMinutes}`;
    await this.walletService.applyLedgerEntry({
      walletId: aspirantWallet.id,
      type: LedgerEntryType.SESSION_DEBIT,
      amountMinor: -extensionCostMinor,
      idempotencyKey: `call-extend-debit:${extensionKey}`,
      sessionId,
      note: `AUDIO_CALL +${extensionMinutes}-min extension`,
    });
    await this.walletService.applyLedgerEntry({
      walletId: mentorWallet.id,
      type: LedgerEntryType.SESSION_CREDIT,
      amountMinor: extensionCostMinor,
      idempotencyKey: `call-extend-credit:${extensionKey}`,
      sessionId,
      note: `AUDIO_CALL +${extensionMinutes}-min extension`,
    });

    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        billedMinutes: { increment: extensionMinutes },
        totalCostMinor: { increment: extensionCostMinor },
      },
    });

    return toSessionResponse(updated);
  }

  /** Either party can end an in-progress call. Billing was already settled
   * at connect/extend time — this only finalizes status. Defensively
   * releases any hold that's somehow still ACTIVE (e.g. the call never
   * actually connected). */
  async endCall(
    sessionId: string,
    userId: string,
    endReason: string = 'NORMAL',
  ): Promise<SessionResponse> {
    const session = await this.requireSessionForParty(sessionId, userId);

    if (session.type !== SessionType.AUDIO_CALL) {
      throw new ForbiddenException('This session is not an audio call session');
    }
    if (session.status !== SessionStatus.IN_PROGRESS && !JOINABLE_STATUSES.includes(session.status)) {
      throw new ConflictException(`Cannot end a call in status ${session.status}`);
    }

    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        endedAt: new Date(),
        endReason,
      },
    });

    await this.releaseHoldsForSession(sessionId);

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

  /** 404 (not 403) for a session the caller isn't a party to — same privacy
   * pattern as findById. Used by the call endpoints, which either party
   * (aspirant or mentor) may call. */
  private async requireSessionForParty(sessionId: string, userId: string): Promise<Session> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [{ aspirantId: userId }, { mentorId: userId }],
      },
    });
    if (!session) {
      throw new NotFoundException(`Session '${sessionId}' not found`);
    }
    return session;
  }

  private async releaseHoldsForSession(sessionId: string): Promise<void> {
    const holds = await this.prisma.walletHold.findMany({
      where: { sessionId, status: HoldStatus.ACTIVE },
    });
    await Promise.all(holds.map((hold) => this.walletService.releaseHold(hold.id)));
  }
}
