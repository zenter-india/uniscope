import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
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

/** No-show grace period, as a fraction of the booked slot — product decision:
 * exactly half the slot, for every slot size (5-min slot -> 2.5 min grace,
 * 10-min -> 5 min, 20-min -> 10 min). Money math stays exact regardless of
 * the fraction — everything is minor units (1000 minor = 1 Uniminute), so
 * 2.5 minutes of fee is a clean 2500 minor, never a rounding problem. Only
 * the cosmetic `billedMinutes` integer column would round awkwardly, which
 * is why a no-show fee is recorded via `totalCostMinor` only, not
 * `billedMinutes` (that column stays 0 — no call minutes were actually
 * billed, this is a distinct no-show fee). */
const CALL_GRACE_FRACTION = 0.5;

/** How often the no-show sweep runs — frequent enough that even the
 * shortest grace period (2.5 min on a 5-min slot) is caught within ~30s of
 * expiring, not minutes late. */
const NO_SHOW_SWEEP_INTERVAL_MS = 30_000;

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
  // DIAGNOSTIC — call-flow tracing for the two-device manual test (see
  // ai/CALL_TEST.md). Logs session/user ids only, never tokens or PII.
  private readonly logger = new Logger(SessionsService.name);

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

    this.logger.log(
      `[call] session created id=${session.id} type=${session.type} ` +
        `slotMinutes=${slotMinutes} freeSlot=${isFreeSlot} aspirant=${aspirantId} mentor=${dto.mentorId}`,
    );

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
        this.logger.log(`[call] hold placed sessionId=${session.id}`);
      } catch (err) {
        // Insufficient balance — undo the session row rather than leaving an
        // orphaned PENDING request the mentor could still see and accept.
        this.logger.warn(
          `[call] hold FAILED sessionId=${session.id} — deleting orphaned session row: ${err}`,
        );
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

    if (isAudioCall) {
      this.logger.log(`[call] sending SESSION_REQUEST sessionId=${session.id} mentor=${dto.mentorId}`);
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

    this.logger.log(
      `[call] session accepted sessionId=${session.id} type=${session.type} mentor=${mentorUserId} ` +
        `(SESSION_ACCEPTED will carry sessionType=${session.type} for mobile deep-link)`,
    );
    await this.notificationsService.send({
      userId: session.aspirantId,
      type: NotificationType.SESSION_ACCEPTED,
      title: 'Request accepted',
      body:
        session.type === SessionType.AUDIO_CALL
          ? 'Your mentor accepted — join the call when ready.'
          : 'Your mentor accepted — start chatting now.',
      // sessionType lets the mobile push handler deep-link straight into
      // the call screen for AUDIO_CALL (vs the chat screen) without an
      // extra round-trip — see mobile_flutter/lib/core/push/push_service.dart.
      metadata: { sessionId: session.id, sessionType: session.type },
    });

    return this.toResponseById(sessionId);
  }

  /** Only the booked mentor may reject, and only while PENDING. */
  async reject(sessionId: string, mentorUserId: string): Promise<SessionResponse> {
    const session = await this.requireSession(sessionId);
    this.requireParty(session, mentorUserId, 'mentor');

    if (session.status !== SessionStatus.PENDING) {
      this.logger.warn(
        `[call] reject FAILED sessionId=${sessionId} — status=${session.status}, expected PENDING`,
      );
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
    this.logger.log(`[call] session rejected sessionId=${sessionId} mentor=${mentorUserId}`);

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
      this.logger.warn(
        `[call] token request FAILED sessionId=${sessionId} userId=${userId} — status=${session.status}`,
      );
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

    this.logger.log(
      `[call] token issued sessionId=${sessionId} userId=${userId} channel=${channelName}`,
    );
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
      this.logger.warn(
        `[call] confirmJoined FAILED sessionId=${sessionId} userId=${userId} — status=${session.status}`,
      );
      throw new ConflictException(`Cannot confirm join for a call in status ${session.status}`);
    }

    const isAspirant = session.aspirantId === userId;
    const now = new Date();
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: isAspirant ? { aspirantJoinedAt: now } : { mentorJoinedAt: now },
    });
    this.logger.log(
      `[call] joined confirmed sessionId=${sessionId} role=${isAspirant ? 'aspirant' : 'mentor'}`,
    );

    const bothJoined = updated.aspirantJoinedAt && updated.mentorJoinedAt;
    if (!bothJoined) {
      this.logger.log(`[call] waiting on other party sessionId=${sessionId}`);
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
      this.logger.log(`[call] both joined but transition already settled by a concurrent call sessionId=${sessionId}`);
      return this.toResponseById(sessionId);
    }

    this.logger.log(`[call] both parties joined — status=IN_PROGRESS sessionId=${sessionId}`);

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
      this.logger.log(`[call] billing settled (paid hold) sessionId=${sessionId} slotMinutes=${slotMinutes}`);
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
      this.logger.log(`[call] billing settled (free tier) sessionId=${sessionId} slotMinutes=${slotMinutes}`);
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
      this.logger.warn(
        `[call] end FAILED sessionId=${sessionId} userId=${userId} — status=${session.status}`,
      );
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
    this.logger.log(
      `[call] call ended sessionId=${sessionId} userId=${userId} reason=${endReason}`,
    );

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

  /**
   * Sweeps AUDIO_CALL sessions sitting in ACCEPTED/RINGING past their grace
   * deadline (respondedAt + CALL_GRACE_FRACTION of the booked slot) and
   * resolves whichever side never joined as a no-show. Runs on a timer
   * rather than being driven by a client request because a no-show is, by
   * definition, a session nobody is actively polling from — there's no
   * "joined" call to hang this off of the way confirmJoined settles a
   * successful connect.
   */
  @Interval(NO_SHOW_SWEEP_INTERVAL_MS)
  async sweepCallNoShows(): Promise<void> {
    const candidates = await this.prisma.session.findMany({
      where: {
        type: SessionType.AUDIO_CALL,
        status: { in: JOINABLE_STATUSES },
        respondedAt: { not: null },
      },
      select: { id: true, respondedAt: true, callSlotMinutes: true },
    });

    const now = Date.now();
    for (const candidate of candidates) {
      if (!candidate.respondedAt || !candidate.callSlotMinutes) continue;
      const graceMs = candidate.callSlotMinutes * CALL_GRACE_FRACTION * 60_000;
      if (now < candidate.respondedAt.getTime() + graceMs) continue;

      try {
        await this.resolveNoShow(candidate.id);
      } catch (err) {
        // One session's resolution failing must not stop the sweep from
        // reaching the rest of the batch — it'll simply be retried on the
        // next tick.
        this.logger.error(`[call] no-show resolution FAILED sessionId=${candidate.id}`, err);
      }
    }
  }

  /** Resolves a single session past its grace deadline — who no-showed,
   * whether a fee applies, and notifying both sides. Guards its own status
   * transition (updateMany + count check) so a late confirmJoined racing
   * the sweep can't be double-resolved, the same pattern confirmJoined
   * itself uses for the both-joined transition. */
  private async resolveNoShow(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || !JOINABLE_STATUSES.includes(session.status)) return;

    const aspirantShowed = session.aspirantJoinedAt !== null;
    const mentorShowed = session.mentorJoinedAt !== null;
    if (aspirantShowed && mentorShowed) return; // confirmJoined already handled this — nothing to do

    const endReason = !aspirantShowed && !mentorShowed
      ? 'NO_ANSWER'
      : aspirantShowed
        ? 'MENTOR_NO_SHOW'
        : 'ASPIRANT_NO_SHOW';

    const settled = await this.prisma.session.updateMany({
      where: { id: sessionId, status: { in: JOINABLE_STATUSES } },
      data: { status: SessionStatus.FAILED, endedAt: new Date(), endReason },
    });
    if (settled.count === 0) return; // lost the race — a concurrent tick or confirmJoined already resolved it

    this.logger.log(`[call] no-show resolved sessionId=${sessionId} reason=${endReason}`);

    const hold = await this.prisma.walletHold.findFirst({
      where: { sessionId, status: HoldStatus.ACTIVE },
    });

    if (endReason === 'ASPIRANT_NO_SHOW' && hold) {
      // Mentor showed up and waited the full grace period — charged the
      // grace-period-equivalent fee, credited to the mentor in full (same
      // zero-margin, same-amount debit/credit pattern as every other
      // session billing path). Only the fee is taken from the hold; the
      // rest of the originally-reserved slot amount was never debited from
      // balanceMinor in the first place (a hold only affects the
      // *available* balance calculation), so there's nothing further to
      // release once the hold is marked settled.
      const graceMinutes = (session.callSlotMinutes ?? 0) * CALL_GRACE_FRACTION;
      const feeMinor = Math.round(graceMinutes * MENTOR_RATE_PER_MINUTE_MINOR);
      const mentorWallet = await this.prisma.wallet.findUniqueOrThrow({
        where: { userId: session.mentorId },
      });

      await this.prisma.walletHold.update({
        where: { id: hold.id },
        data: { status: HoldStatus.CONSUMED },
      });
      await this.walletService.applyLedgerEntry({
        walletId: hold.walletId,
        type: LedgerEntryType.SESSION_DEBIT,
        amountMinor: -feeMinor,
        idempotencyKey: `no-show-debit:${sessionId}`,
        sessionId,
        note: `No-show fee — your mentor waited, you didn't join`,
      });
      await this.walletService.applyLedgerEntry({
        walletId: mentorWallet.id,
        type: LedgerEntryType.SESSION_CREDIT,
        amountMinor: feeMinor,
        idempotencyKey: `no-show-credit:${sessionId}`,
        sessionId,
        note: `No-show compensation — aspirant didn't join`,
      });
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { totalCostMinor: feeMinor },
      });
    } else if (endReason === 'ASPIRANT_NO_SHOW') {
      // Free-tier booking (no hold) — nothing to bill the mentor's way
      // through, since free-tier sessions never pay the mentor even on a
      // normal connect (see confirmJoined). The aspirant still "spends"
      // the grace-period minutes off their free tier, so it isn't
      // consequence-free for them, just not mentor-compensated.
      await this.prisma.userProfile.updateMany({
        where: { userId: session.aspirantId },
        data: {
          freeCallSecondsRemaining: {
            decrement: Math.round((session.callSlotMinutes ?? 0) * CALL_GRACE_FRACTION * 60),
          },
        },
      });
      await this.prisma.userProfile.updateMany({
        where: { userId: session.aspirantId, freeCallSecondsRemaining: { lt: 0 } },
        data: { freeCallSecondsRemaining: 0 },
      });
    } else if (hold) {
      // Mentor no-show, or neither side showed — nothing billable
      // happened, full release back to spendable balance.
      await this.walletService.releaseHold(hold.id);
    }

    const body =
      endReason === 'ASPIRANT_NO_SHOW'
        ? 'You were charged a no-show fee for not joining in time.'
        : endReason === 'MENTOR_NO_SHOW'
          ? "Your mentor didn't join in time — nothing was charged."
          : "Nobody joined in time — nothing was charged.";
    const mentorBody =
      endReason === 'ASPIRANT_NO_SHOW'
        ? "The aspirant didn't join — you've been compensated for waiting."
        : endReason === 'MENTOR_NO_SHOW'
          ? "You didn't join in time — the call was marked a no-show."
          : "Nobody joined in time — the call was marked a no-show.";

    await Promise.all([
      this.notificationsService.send({
        userId: session.aspirantId,
        type: NotificationType.SESSION_ENDED,
        title: 'Call missed',
        body,
        metadata: { sessionId: session.id },
      }),
      this.notificationsService.send({
        userId: session.mentorId,
        type: NotificationType.SESSION_ENDED,
        title: 'Call missed',
        body: mentorBody,
        metadata: { sessionId: session.id },
      }),
    ]);
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
