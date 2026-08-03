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
  NotificationType,
  Prisma,
  Session,
  SessionStatus,
  SessionType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { AgoraService } from '../agora/agora.service.js';
import { AvatarService } from '../avatar/avatar.service.js';
import { BlocksService } from '../blocks/blocks.service.js';
import { ChatService } from '../chat/chat.service.js';
import { MentorsService } from '../mentors/mentors.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { MENTOR_RATE_PER_MINUTE_MINOR, WalletService } from '../wallet/wallet.service.js';
import { CALL_SLOT_MINUTES, CreateSessionDto } from './dto/create-session.dto.js';
import { ListSessionsDto } from './dto/list-sessions.dto.js';
import {
  AvatarUrlResolver,
  SESSION_WITH_NAMES_INCLUDE,
  SessionResponse,
  toSessionResponse,
} from './session-response.js';

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
    private readonly notificationsService: NotificationsService,
    private readonly blocksService: BlocksService,
    private readonly avatarService: AvatarService,
  ) {}

  /** Passed to toSessionResponse at every call site — keeps that file DI-free. */
  private resolveAvatarUrl: AvatarUrlResolver = (userId, avatarKey, updatedAt) =>
    this.avatarService.publicUrl(userId, avatarKey, updatedAt);

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

    // Blocking is checked in either direction — same 404 the mentor-not-
    // found path uses, so a blocked party can't tell whether they were
    // blocked or the mentor just doesn't exist (avoids leaking block state).
    if (await this.blocksService.isBlockedEitherDirection(aspirantId, dto.mentorId)) {
      throw new NotFoundException(`Mentor '${dto.mentorId}' not found`);
    }

    // Throws NotFoundException if the mentor isn't eligible (unverified,
    // inactive, banned) — same check GET /mentors/:id uses. Being
    // unavailable no longer disqualifies a mentor here; it only blocks
    // AUDIO_CALL specifically, checked just below.
    const mentor = await this.mentorsService.findById(dto.mentorId);

    // mentor.isAvailable is already expiry-aware (see isCallAvailable) — a
    // stale opt-in reads as false here, so nobody can book against a mentor
    // who switched on days ago and forgot.
    if (dto.type === SessionType.AUDIO_CALL && !mentor.isAvailable) {
      throw new ConflictException(
        'This mentor is not accepting call bookings right now — you can still start a chat with them.',
      );
    }

    // Scoped by type as well as mentor — an aspirant can have an active
    // CHAT and an active AUDIO_CALL with the same mentor at once (e.g.
    // requesting a call from inside an already-open chat). Only a second
    // request of the SAME type is a duplicate.
    const existingActive = await this.prisma.session.findFirst({
      where: {
        aspirantId,
        mentorId: dto.mentorId,
        type: dto.type,
        status: { in: ACTIVE_STATUSES },
      },
    });
    if (existingActive) {
      throw new ConflictException(
        dto.type === SessionType.AUDIO_CALL
          ? 'You already have an active call request with this mentor'
          : 'You already have an active chat with this mentor',
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
        // CHAT is always free — only AUDIO_CALL is billed, and always at the
        // flat platform rate, never a mentor-set price (see product
        // decision: chat with any mentor costs nothing, no per-mentor rate).
        ratePerMinuteMinor: isAudioCall ? MENTOR_RATE_PER_MINUTE_MINOR : 0,
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

    // CHAT sessions open immediately — no mentor accept step. Only
    // AUDIO_CALL still goes through the request/accept state machine (it
    // involves a wallet hold and the mentor's scheduling availability, so a
    // deliberate accept still makes sense there).
    if (!isAudioCall) {
      const aspirant = await this.prisma.user.findUniqueOrThrow({
        where: { id: aspirantId },
        select: { displayName: true, profile: { select: { avatarKey: true, updatedAt: true } } },
      });
      const streamChannelId = await this.chatService.ensureChannelForSession({
        sessionId: session.id,
        aspirantId,
        aspirantName: aspirant.displayName,
        aspirantAvatarUrl: aspirant.profile
          ? this.avatarService.publicUrl(
              aspirantId,
              aspirant.profile.avatarKey,
              aspirant.profile.updatedAt,
            )
          : null,
        mentorId: dto.mentorId,
        mentorName: mentor.displayName,
        mentorAvatarUrl: mentor.avatarUrl,
      });
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.ACCEPTED,
          respondedAt: new Date(),
          streamChannelId,
        },
      });
    }

    await this.notificationsService.send({
      userId: dto.mentorId,
      type: isAudioCall ? NotificationType.SESSION_REQUEST : NotificationType.MESSAGE,
      title: isAudioCall ? 'New audio call request' : 'New chat',
      body: isAudioCall
        ? `A student booked a ${slotMinutes}-min audio call with you.`
        : 'A student started a chat with you.',
      metadata: { sessionId: session.id },
    });

    return this.toResponseById(session.id);
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
    // their Agora channel later, at the connect leg). In practice CHAT
    // sessions no longer pass through PENDING at all (see create() — they
    // open immediately), so this branch is dead for CHAT today; kept for
    // type-correctness and as a defensive fallback if that ever changes.
    let streamChannelId: string | undefined;
    if (session.type === SessionType.CHAT) {
      const [aspirant, mentor] = await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id: session.aspirantId },
          select: { displayName: true, profile: { select: { avatarKey: true, updatedAt: true } } },
        }),
        this.prisma.user.findUniqueOrThrow({
          where: { id: session.mentorId },
          select: { displayName: true, profile: { select: { avatarKey: true, updatedAt: true } } },
        }),
      ]);
      streamChannelId = await this.chatService.ensureChannelForSession({
        sessionId: session.id,
        aspirantId: session.aspirantId,
        aspirantName: aspirant.displayName,
        aspirantAvatarUrl: aspirant.profile
          ? this.avatarService.publicUrl(
              session.aspirantId,
              aspirant.profile.avatarKey,
              aspirant.profile.updatedAt,
            )
          : null,
        mentorId: session.mentorId,
        mentorName: mentor.displayName,
        mentorAvatarUrl: mentor.profile
          ? this.avatarService.publicUrl(
              session.mentorId,
              mentor.profile.avatarKey,
              mentor.profile.updatedAt,
            )
          : null,
      });
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.ACCEPTED,
        respondedAt: new Date(),
        ...(streamChannelId && { streamChannelId }),
      },
    });

    await this.notificationsService.send({
      userId: session.aspirantId,
      type: NotificationType.SESSION_ACCEPTED,
      title: 'Request accepted',
      body:
        session.type === SessionType.AUDIO_CALL
          ? 'Your mentor accepted — join the call when ready.'
          : 'Your mentor accepted — start chatting now.',
      metadata: { sessionId: session.id },
    });

    return this.toResponseById(sessionId);
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
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.REJECTED,
        respondedAt: now,
        endedAt: now,
        endReason: 'REJECTED',
      },
    });

    await this.releaseHoldsForSession(sessionId);

    await this.notificationsService.send({
      userId: session.aspirantId,
      type: NotificationType.SESSION_REJECTED,
      title: 'Request declined',
      body: 'Your mentor is unavailable for this request.',
      metadata: { sessionId: session.id },
    });

    return this.toResponseById(sessionId);
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

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.CANCELLED,
        endedAt: new Date(),
        endReason: 'CANCELLED',
      },
    });

    await this.releaseHoldsForSession(sessionId);

    return this.toResponseById(sessionId);
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
      return this.toResponseById(sessionId);
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
      return this.toResponseById(sessionId);
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

    return this.toResponseById(sessionId);
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

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        billedMinutes: { increment: extensionMinutes },
        totalCostMinor: { increment: extensionCostMinor },
      },
    });

    return this.toResponseById(sessionId);
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

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        endedAt: new Date(),
        endReason,
      },
    });

    await this.releaseHoldsForSession(sessionId);

    const otherPartyId =
      userId === session.aspirantId ? session.mentorId : session.aspirantId;
    await this.notificationsService.send({
      userId: otherPartyId,
      type: NotificationType.SESSION_ENDED,
      title: 'Call ended',
      body: endReason === 'SLOT_EXPIRED' ? 'The paid slot ended.' : 'The call has ended.',
      metadata: { sessionId: session.id },
    });

    return this.toResponseById(sessionId);
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
      include: SESSION_WITH_NAMES_INCLUDE,
      orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const rowsPage = hasMore ? rows.slice(0, take) : rows;
    const data = rowsPage.map((row) => toSessionResponse(row, this.resolveAvatarUrl));
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
      include: SESSION_WITH_NAMES_INCLUDE,
    });

    if (!session) {
      throw new NotFoundException(`Session '${sessionId}' not found`);
    }

    return toSessionResponse(session, this.resolveAvatarUrl);
  }

  /** Re-fetches a session with the aspirant/mentor names included — used
   * after every mutation instead of threading `include` through each
   * individual update() call. */
  private async toResponseById(sessionId: string): Promise<SessionResponse> {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      include: SESSION_WITH_NAMES_INCLUDE,
    });
    return toSessionResponse(session, this.resolveAvatarUrl);
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
