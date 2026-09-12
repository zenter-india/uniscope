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
  UserRole,
} from '@prisma/client';
import { adminOrderBy } from '../../common/helpers/admin-sort.helper.js';
import {
  rupeesLabel,
  uniminutesLabel,
} from '../../common/helpers/notification-format.helper.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { AgoraService } from '../agora/agora.service.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import { AvatarService } from '../avatar/avatar.service.js';
import { BlocksService } from '../blocks/blocks.service.js';
import { ChatService } from '../chat/chat.service.js';
import { MentorsService } from '../mentors/mentors.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { MENTOR_RATE_PER_MINUTE_MINOR, WalletService } from '../wallet/wallet.service.js';
import { AcceptSessionDto } from './dto/accept-session.dto.js';
import { CALL_SLOT_MINUTES, CreateSessionDto } from './dto/create-session.dto.js';
import { ListSessionsAdminDto } from './dto/list-sessions-admin.dto.js';
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

/** A scheduled call (`confirmedFor` set) can't be joined more than this many
 * minutes before its confirmed slot — otherwise "Accept" on a scheduled
 * request connected the call immediately instead of waiting for the agreed
 * time, since ACCEPTED is joinable status-wise regardless of `confirmedFor`.
 * An instant request (`confirmedFor` null) is unaffected — this only gates
 * calls the mentor scheduled for later. */
const CALL_EARLY_JOIN_WINDOW_MINUTES = 5;

/** How often the no-show sweep runs — frequent enough that even the
 * shortest grace period (2.5 min on a 5-min slot) is caught within ~30s of
 * expiring, not minutes late. */
const NO_SHOW_SWEEP_INTERVAL_MS = 30_000;

/** e.g. "Tue, Sep 9, 4:30 PM" — IST (the app's only market). Node's Intl
 * ships the tz data. Shared by the request push (create) and the
 * confirmation push (accept). */
const fmtIst = (d: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(d);

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
    private readonly reviewsService: ReviewsService,
  ) {}

  /** Passed to toSessionResponse at every call site — keeps that file DI-free. */
  private resolveAvatarUrl: AvatarUrlResolver = (userId, avatarKey, updatedAt) =>
    this.avatarService.publicUrl(userId, avatarKey, updatedAt);

  /**
   * Creates a PENDING booking request. The mentor's current rate is
   * snapshotted onto the session at creation time — later rate changes must
   * never retroactively affect this session.
   *
   * AUDIO_CALL is a fixed pre-paid slot (6/10/20 min, see CreateSessionDto):
   * **there is no free-call tier** — every call, no exceptions, requires a
   * WalletHold for the full slot cost placed here at BOOKING time (so the
   * mentor never accepts a request the aspirant can't afford, and no call
   * can ever connect without real Uniminutes backing it) — the hold is only
   * converted into an actual debit once the call server-
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
      // CHAT is find-or-create: re-opening a chat you already have with this
      // mentor just returns it (mirrors startChatWithStudent's idempotency),
      // so the client never has to catch a 409 and scan its own — paginated,
      // so possibly incomplete — session list to recover the existing one.
      // A second AUDIO_CALL while one is still outstanding IS a real
      // duplicate the aspirant should be told about, so that stays a 409.
      if (dto.type === SessionType.CHAT) {
        return this.toResponseById(existingActive.id);
      }
      throw new ConflictException(
        'You already have an active call request with this mentor',
      );
    }

    const isAudioCall = dto.type === SessionType.AUDIO_CALL;
    const slotMinutes = dto.slotMinutes ?? 0;
    const slotCostMinor = slotMinutes * MENTOR_RATE_PER_MINUTE_MINOR;

    // "When?" step: Instant → requestedFor stays null (connect once the
    // mentor accepts, the original flow). A mentor free-window pick or a
    // custom slot sends a concrete ISO timestamp — the aspirant may send
    // TWO (requestedFor + requestedForAlt) as options for the mentor to
    // choose between. Advisory only, so all we do is sanity-bound each (not
    // in the past, not more than 4 days out) and store it. No
    // hold/no-show/billing change.
    const boundRequestedTime = (
      value: string | undefined,
      field: string,
    ): Date | null => {
      if (!value) return null;
      const parsed = new Date(value);
      const now = Date.now();
      const maxAheadMs = 4 * 24 * 60 * 60 * 1000;
      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.getTime() < now - 60_000 ||
        parsed.getTime() > now + maxAheadMs
      ) {
        throw new BadRequestException(
          `${field} must be a time between now and 4 days ahead`,
        );
      }
      return parsed;
    };

    let requestedFor: Date | null = null;
    let requestedForAlt: Date | null = null;
    if (isAudioCall) {
      requestedFor = boundRequestedTime(dto.requestedFor, 'requestedFor');
      // A second option only makes sense alongside a first one.
      if (requestedFor) {
        requestedForAlt = boundRequestedTime(
          dto.requestedForAlt,
          'requestedForAlt',
        );
      }
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
        ...(requestedFor && { requestedFor }),
        ...(requestedForAlt && { requestedForAlt }),
      },
    });

    this.logger.log(
      `[call] session created id=${session.id} type=${session.type} ` +
        `slotMinutes=${slotMinutes} aspirant=${aspirantId} mentor=${dto.mentorId}`,
    );

    // Strict policy: no free-call tier — every AUDIO_CALL, no exceptions,
    // must place a real WalletHold for the full slot cost. placeHold throws
    // (and the orphaned session row below is deleted) if the aspirant can't
    // actually afford it, so a call request can never reach the mentor
    // unless the aspirant already has the Uniminutes to pay for it.
    if (isAudioCall) {
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
      await this.chatService.ensureChannelForSession(session.id);
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });
    }

    if (isAudioCall) {
      this.logger.log(`[call] sending SESSION_REQUEST sessionId=${session.id} mentor=${dto.mentorId}`);
    }

    // The mentor decides whether to accept now or plan for later, so the
    // notification itself has to say which kind of request this is and, when
    // scheduled, the time(s) the student offered — see the module-level
    // `fmtIst` (also used by the confirmation push in accept()).
    let callTitle = 'New audio call request';
    let callBody = `A student booked a ${slotMinutes}-min audio call with you.`;
    if (isAudioCall && !requestedFor) {
      callTitle = 'New instant call request';
      callBody = `A student wants a ${slotMinutes}-min call now — accept to connect.`;
    } else if (isAudioCall && requestedForAlt) {
      callBody =
        `A student booked a ${slotMinutes}-min call — ` +
        `${fmtIst(requestedFor!)} or ${fmtIst(requestedForAlt)}.`;
    } else if (isAudioCall && requestedFor) {
      callBody = `A student booked a ${slotMinutes}-min call for ${fmtIst(requestedFor)}.`;
    }

    await this.notificationsService.send({
      userId: dto.mentorId,
      type: isAudioCall ? NotificationType.SESSION_REQUEST : NotificationType.MESSAGE,
      title: isAudioCall ? callTitle : 'New chat',
      body: isAudioCall ? callBody : 'A student started a chat with you.',
      // `instant` (only meaningful for SESSION_REQUEST) tells the client
      // whether to ring like a real incoming call (flutter_callkit_incoming)
      // or just show a normal notification — a *scheduled* request ("call
      // me at 2pm") isn't happening right now, so it must never ring.
      metadata: isAudioCall
        ? { sessionId: session.id, instant: String(!requestedFor) }
        : { sessionId: session.id },
    });

    return this.toResponseById(session.id);
  }

  /**
   * Mentor-initiated chat with a student. Aspirants normally open the first
   * chat (see `create` — `POST /sessions` is aspirant-scoped), but a mentor
   * with a student on their Sessions tab needs to be able to reach them
   * without waiting for the student to message first.
   *
   * Scoped, on purpose:
   *  - caller must be a MENTOR,
   *  - they must ALREADY share at least one session with this student (any
   *    type, any status) — this is "message someone you're working with",
   *    not a cold-outreach / people-search capability,
   *  - chat only — a mentor never initiates an AUDIO_CALL (calls are booked
   *    and paid for by the aspirant; the mentor is never billed).
   *
   * Idempotent: returns the existing active CHAT thread if there is one, so a
   * double-tap can't spawn a second channel.
   */
  async startChatWithStudent(
    mentorId: string,
    aspirantId: string,
  ): Promise<SessionResponse> {
    if (mentorId === aspirantId) {
      throw new ConflictException('You cannot start a chat with yourself');
    }

    const caller = await this.prisma.user.findUnique({
      where: { id: mentorId },
      select: { role: true },
    });
    if (caller?.role !== UserRole.MENTOR) {
      throw new ForbiddenException(
        'Only mentors can start a chat with a student from here',
      );
    }

    // "Only existing relationships" — the mentor must already be a party to
    // at least one session with this student.
    const shared = await this.prisma.session.findFirst({
      where: { mentorId, aspirantId },
      select: { id: true },
    });
    if (!shared) {
      throw new ForbiddenException(
        'You can only start a chat with a student you already have a session with',
      );
    }

    // Same 404-not-403 block handling as create() — don't leak block state.
    if (
      await this.blocksService.isBlockedEitherDirection(mentorId, aspirantId)
    ) {
      throw new NotFoundException(`Student '${aspirantId}' not found`);
    }

    const existing = await this.prisma.session.findFirst({
      where: {
        mentorId,
        aspirantId,
        type: SessionType.CHAT,
        status: { in: ACTIVE_STATUSES },
      },
    });
    if (existing) return this.toResponseById(existing.id);

    const session = await this.prisma.session.create({
      data: {
        aspirantId,
        mentorId,
        type: SessionType.CHAT,
        ratePerMinuteMinor: 0, // chat is always free
      },
    });

    // CHAT opens immediately — provision the channel and mark ACCEPTED,
    // exactly as an aspirant-initiated chat does in create().
    await this.chatService.ensureChannelForSession(session.id);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { status: SessionStatus.ACCEPTED, respondedAt: new Date() },
    });

    await this.notificationsService.send({
      userId: aspirantId,
      type: NotificationType.MESSAGE,
      title: 'New chat',
      body: 'A mentor started a chat with you.',
      metadata: { sessionId: session.id },
    });

    return this.toResponseById(session.id);
  }

  /** Only the booked mentor may accept, and only while PENDING. */
  async accept(
    sessionId: string,
    mentorUserId: string,
    dto: AcceptSessionDto = {},
  ): Promise<SessionResponse> {
    const session = await this.requireSession(sessionId);
    this.requireParty(session, mentorUserId, 'mentor');

    if (session.status !== SessionStatus.PENDING) {
      throw new ConflictException(
        `Cannot accept a session in status ${session.status}`,
      );
    }

    // The mentor picks a concrete 30-min slot from the strip the mobile
    // confirm sheet offers around the aspirant's requested time(s). Backstop
    // validation here — the sheet already keeps it in range.
    const confirmedFor = this.resolveConfirmedSlot(session, dto.confirmedFor);

    // Double-booking guard: a confirmed slot is a real commitment (the
    // no-show clock runs from it), so the mentor can't hand the same window
    // to two students. Reject if this slot's [start, start+thisSlot)
    // interval overlaps another of the mentor's still-live confirmed calls.
    // The mobile confirm sheet greys these out, but a stale sheet or a
    // second device could still send one — this is the authority.
    if (confirmedFor) {
      const thisSlotMin = session.callSlotMinutes ?? 20;
      const thisStart = confirmedFor.getTime();
      const thisEnd = thisStart + thisSlotMin * 60_000;
      // Widest a slot can be is 20 min, so anything starting > 20 min either
      // side cannot overlap — bound the scan, then check intervals exactly.
      const nearby = await this.prisma.session.findMany({
        where: {
          id: { not: sessionId },
          mentorId: mentorUserId,
          type: SessionType.AUDIO_CALL,
          status: { in: ACTIVE_STATUSES },
          confirmedFor: {
            gt: new Date(thisStart - 20 * 60_000),
            lt: new Date(thisEnd + 20 * 60_000),
          },
        },
        select: { confirmedFor: true, callSlotMinutes: true },
      });
      const clash = nearby.find((o) => {
        const oStart = o.confirmedFor!.getTime();
        const oEnd = oStart + (o.callSlotMinutes ?? 20) * 60_000;
        return thisStart < oEnd && oStart < thisEnd;
      });
      if (clash) {
        throw new ConflictException(
          `You already have a call confirmed around ${fmtIst(clash.confirmedFor!)}. ` +
            `Pick a slot that doesn't overlap it.`,
        );
      }
    }

    // For CHAT sessions the chat channel is the messaging surface itself,
    // so it's provisioned right on accept (AUDIO_CALL sessions provision
    // their call room later, at the connect leg). In practice CHAT
    // sessions no longer pass through PENDING at all (see create() — they
    // open immediately), so this branch is dead for CHAT today; kept for
    // type-correctness and as a defensive fallback if that ever changes.
    if (session.type === SessionType.CHAT) {
      await this.chatService.ensureChannelForSession(session.id);
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.ACCEPTED,
        respondedAt: new Date(),
        ...(confirmedFor && { confirmedFor }),
      },
    });

    this.logger.log(
      `[call] session accepted sessionId=${session.id} type=${session.type} mentor=${mentorUserId} ` +
        `confirmedFor=${confirmedFor?.toISOString() ?? 'none'} ` +
        `(SESSION_ACCEPTED will carry sessionType=${session.type} for mobile deep-link)`,
    );

    let body: string;
    if (session.type !== SessionType.AUDIO_CALL) {
      body = 'Your mentor accepted — start chatting now.';
    } else if (confirmedFor) {
      body =
        `Your mentor confirmed ${fmtIst(confirmedFor)} for your call. ` +
        `Join within that 30-minute window.`;
    } else {
      body = 'Your mentor accepted — join the call when ready.';
    }
    // `sessionType: 'AUDIO_CALL'` is the flag the mobile push handler uses to
    // deep-link STRAIGHT into the call screen on receipt. That is correct for
    // an Instant accept (connect now) but wrong for a scheduled one — it would
    // yank the student into a call hours before the confirmed slot. So a
    // scheduled accept carries `confirmedFor` for reference but NOT
    // `sessionType`; the student just gets the "confirmed for {time}" notice,
    // and the SESSION_STARTING push (first-join, and the ~2-min-before sweep)
    // is what actually pulls both sides in at call time.
    await this.notificationsService.send({
      userId: session.aspirantId,
      type: NotificationType.SESSION_ACCEPTED,
      title: 'Request accepted',
      body,
      metadata: confirmedFor
        ? { sessionId: session.id, confirmedFor: confirmedFor.toISOString() }
        : { sessionId: session.id, sessionType: session.type },
    });

    return this.toResponseById(sessionId);
  }

  /**
   * Validates the mentor's chosen 30-minute slot against the aspirant's
   * request. Returns the parsed Date, or null when no slot was supplied
   * (legacy accept — behaves exactly as before). Throws BadRequestException
   * on anything out of bounds. Rules: the request must be scheduled (an
   * Instant request has no anchor to confirm against); the slot must be on
   * a :00/:30 boundary, in the future, ≤ 5 days out, and within ~4 hours of
   * `requestedFor` or `requestedForAlt`.
   */
  private resolveConfirmedSlot(
    session: { type: SessionType; requestedFor: Date | null; requestedForAlt: Date | null },
    value: string | undefined,
  ): Date | null {
    if (!value) return null;
    if (session.type !== SessionType.AUDIO_CALL) {
      throw new BadRequestException('confirmedFor is only valid for a call');
    }
    if (!session.requestedFor) {
      throw new BadRequestException(
        'This is an instant request — there is no time to confirm',
      );
    }
    const slot = new Date(value);
    const t = slot.getTime();
    if (Number.isNaN(t)) {
      throw new BadRequestException('confirmedFor is not a valid time');
    }
    if (slot.getUTCSeconds() !== 0 || slot.getUTCMilliseconds() !== 0 ||
        (slot.getUTCMinutes() !== 0 && slot.getUTCMinutes() !== 30)) {
      throw new BadRequestException('confirmedFor must be a 30-minute slot');
    }
    const now = Date.now();
    if (t < now - 60_000) {
      throw new BadRequestException('confirmedFor is in the past');
    }
    if (t > now + 5 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('confirmedFor is more than 5 days ahead');
    }
    const WINDOW_MS = 4 * 60 * 60 * 1000 + 60_000; // one 4-hour block + slack
    const anchors = [session.requestedFor, session.requestedForAlt].filter(
      (d): d is Date => d != null,
    );
    const nearAnchor = anchors.some((a) => Math.abs(t - a.getTime()) <= WINDOW_MS);
    if (!nearAnchor) {
      throw new BadRequestException(
        'confirmedFor must be close to one of the times the student offered',
      );
    }
    return slot;
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

    const heldMinor =
      (
        await this.prisma.walletHold.aggregate({
          where: { sessionId, status: HoldStatus.ACTIVE },
          _sum: { amountMinor: true },
        })
      )._sum.amountMinor ?? 0;
    await this.releaseHoldsForSession(sessionId);
    this.logger.log(`[call] session rejected sessionId=${sessionId} mentor=${mentorUserId}`);

    await this.notificationsService.send({
      userId: session.aspirantId,
      type: NotificationType.SESSION_REJECTED,
      title: 'Request declined',
      body:
        heldMinor > 0
          ? `Your mentor is unavailable for this request. Your ${uniminutesLabel(heldMinor)} hold has been released.`
          : 'Your mentor is unavailable for this request.',
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
    if (
      session.confirmedFor &&
      session.status !== SessionStatus.IN_PROGRESS &&
      Date.now() < session.confirmedFor.getTime() - CALL_EARLY_JOIN_WINDOW_MINUTES * 60_000
    ) {
      throw new ConflictException(
        `This call is scheduled for ${fmtIst(session.confirmedFor)}. ` +
          `You can join starting ${CALL_EARLY_JOIN_WINDOW_MINUTES} minutes before.`,
      );
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
   * IN_PROGRESS and settles billing exactly once by consuming the booking
   * hold placed at create() time. There is no free-call tier — every new
   * AUDIO_CALL always has a hold; the no-hold branch below only exists to
   * settle a pre-existing legacy free-tier session already in flight.
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
      // Tell the party who ISN'T here yet that the call is live — this is
      // the alert the mentor was missing on a scheduled call (they'd
      // confirmed a slot hours earlier and moved on). sessionType routes
      // the mobile push handler straight into the call screen.
      const waitingOn = isAspirant ? session.mentorId : session.aspirantId;
      const { aspirantName, mentorName } = await this.partyNames(
        session.aspirantId,
        session.mentorId,
      );
      const joinerName = isAspirant ? aspirantName : mentorName;
      await this.notifySafe({
        userId: waitingOn,
        type: NotificationType.SESSION_STARTING,
        title: 'Call starting',
        body: `${joinerName} is on the call — join now.`,
        metadata: { sessionId: session.id, sessionType: 'AUDIO_CALL' },
      });
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

      const { aspirantName, mentorName } = await this.partyNames(
        session.aspirantId,
        session.mentorId,
      );
      await Promise.all([
        this.notifySafe({
          userId: session.aspirantId,
          type: NotificationType.PAYMENT,
          title: 'Call charged',
          body: `${uniminutesLabel(slotCostMinor)} used for your ${slotMinutes}-min call with ${mentorName}.`,
          metadata: { sessionId },
        }),
        this.notifySafe({
          userId: session.mentorId,
          type: NotificationType.PAYMENT,
          title: 'You earned',
          body: `${rupeesLabel(slotCostMinor)} for your ${slotMinutes}-min call with ${aspirantName}.`,
          metadata: { sessionId },
        }),
      ]);

      // Nudge the aspirant if this call left them unable to book the
      // shortest slot again — mirrors the client-side low-balance gate.
      const availableAfter = await this.walletService.getAvailableBalanceMinor(
        hold.walletId,
      );
      if (availableAfter < CALL_SLOT_MINUTES[0] * MENTOR_RATE_PER_MINUTE_MINOR) {
        await this.notifySafe({
          userId: session.aspirantId,
          type: NotificationType.LOW_BALANCE,
          title: 'Low balance',
          body: `You have ${uniminutesLabel(availableAfter)} left — top up to book another call.`,
          metadata: { kind: 'low_balance' },
        });
      }
    } else {
      // No hold — there is no free-call tier anymore, so this should be
      // unreachable for any session created after that policy landed. Keep
      // the free-tier settle path only to close out a legacy session that
      // was already mid-flight when the policy changed.
      this.logger.warn(
        `[call] confirmJoined settling with NO hold sessionId=${sessionId} — ` +
          `legacy free-tier session (no free-call tier for new sessions)`,
      );
      await this.prisma.userProfile.updateMany({
        where: { userId: session.aspirantId },
        data: { freeCallSecondsRemaining: { decrement: slotMinutes * 60 } },
      });
      await this.prisma.userProfile.updateMany({
        where: { userId: session.aspirantId, freeCallSecondsRemaining: { lt: 0 } },
        data: { freeCallSecondsRemaining: 0 },
      });
      this.logger.log(`[call] billing settled (legacy free tier) sessionId=${sessionId} slotMinutes=${slotMinutes}`);
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

    const extensionMinutes = CALL_SLOT_MINUTES[0]; // fixed +6 min (shortest slot), see product decision
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

    const { aspirantName, mentorName } = await this.partyNames(
      session.aspirantId,
      session.mentorId,
    );
    await Promise.all([
      this.notifySafe({
        userId: session.aspirantId,
        type: NotificationType.PAYMENT,
        title: 'Call extended',
        body: `${uniminutesLabel(extensionCostMinor)} used to add ${extensionMinutes} minutes with ${mentorName}.`,
        metadata: { sessionId },
      }),
      this.notifySafe({
        userId: session.mentorId,
        type: NotificationType.PAYMENT,
        title: 'You earned',
        body: `${rupeesLabel(extensionCostMinor)} for a ${extensionMinutes}-min extension with ${aspirantName}.`,
        metadata: { sessionId },
      }),
    ]);

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
   * ~2 minutes before a scheduled call's `confirmedFor`, pushes a
   * "your call is starting" notification to BOTH parties exactly once
   * (`startingNotifiedAt` guards against repeats). This is what pulls in a
   * party whose app was closed since the slot was confirmed hours earlier —
   * the first-join push in confirmJoined only helps once someone is already
   * on the call screen. Instant calls (no `confirmedFor`) are handled by the
   * accept flow and never reach here.
   */
  @Interval(NO_SHOW_SWEEP_INTERVAL_MS)
  async remindScheduledCallsStarting(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.session.findMany({
      where: {
        type: SessionType.AUDIO_CALL,
        status: SessionStatus.ACCEPTED,
        startingNotifiedAt: null,
        confirmedFor: {
          not: null,
          lte: new Date(now.getTime() + 2 * 60_000),
          gte: new Date(now.getTime() - 10 * 60_000),
        },
      },
      select: {
        id: true,
        aspirantId: true,
        mentorId: true,
        confirmedFor: true,
      },
    });

    for (const s of due) {
      try {
        // Claim it first so a slow push can't cause a double-fire on the
        // next tick.
        const claimed = await this.prisma.session.updateMany({
          where: { id: s.id, startingNotifiedAt: null },
          data: { startingNotifiedAt: now },
        });
        if (claimed.count === 0) continue;

        const { aspirantName, mentorName } = await this.partyNames(
          s.aspirantId,
          s.mentorId,
        );
        const when = s.confirmedFor ? fmtIst(s.confirmedFor) : 'now';
        await Promise.all([
          this.notifySafe({
            userId: s.aspirantId,
            type: NotificationType.SESSION_STARTING,
            title: 'Call starting soon',
            body: `Your call with ${mentorName} is at ${when} — open the app to join.`,
            metadata: { sessionId: s.id, sessionType: 'AUDIO_CALL' },
          }),
          this.notifySafe({
            userId: s.mentorId,
            type: NotificationType.SESSION_STARTING,
            title: 'Call starting soon',
            body: `Your call with ${aspirantName} is at ${when} — open the app to join.`,
            metadata: { sessionId: s.id, sessionType: 'AUDIO_CALL' },
          }),
        ]);
      } catch (err) {
        this.logger.error(`[call] starting-reminder FAILED sessionId=${s.id}`, err);
      }
    }
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
      select: {
        id: true,
        respondedAt: true,
        confirmedFor: true,
        callSlotMinutes: true,
      },
    });

    const now = Date.now();
    for (const candidate of candidates) {
      if (!candidate.respondedAt || !candidate.callSlotMinutes) continue;
      const graceMs = candidate.callSlotMinutes * CALL_GRACE_FRACTION * 60_000;
      // The grace clock runs from whichever is later: the mentor's accept,
      // or the confirmed slot start. A call confirmed for a slot days ahead
      // must survive untouched until that slot actually arrives.
      const clockStart = Math.max(
        candidate.respondedAt.getTime(),
        candidate.confirmedFor?.getTime() ?? 0,
      );
      if (now < clockStart + graceMs) continue;

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
      // No hold — there is no free-call tier for any session created after
      // that policy change (every call now always places a hold at create()
      // time), so this branch is legacy-only: nothing to bill the mentor's
      // way through, since free-tier sessions never paid the mentor even on a
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

    // MENTOR_NO_SHOW / NO_ANSWER released the hold above — tell the aspirant
    // their reserved Uniminutes are back.
    const releasedSuffix =
      hold && endReason !== 'ASPIRANT_NO_SHOW'
        ? ` Your ${uniminutesLabel(hold.amountMinor)} hold has been released.`
        : '';
    const body =
      endReason === 'ASPIRANT_NO_SHOW'
        ? 'You were charged a no-show fee for not joining in time.'
        : endReason === 'MENTOR_NO_SHOW'
          ? `Your mentor didn't join in time — nothing was charged.${releasedSuffix}`
          : `Nobody joined in time — nothing was charged.${releasedSuffix}`;
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

    // Attach a last-message preview to each CHAT session (the Sessions list
    // renders WhatsApp-style). One query for the channels on this page, one
    // for the newest message per channel (distinct on channelId, index
    // (channel_id, created_at) backs the ordering). AUDIO_CALL rows have no
    // channel and stay null.
    const chatSessionIds = rowsPage
      .filter((r) => r.type === SessionType.CHAT)
      .map((r) => r.id);
    const lastMsgBySessionId = new Map<
      string,
      { text: string; senderId: string; createdAt: Date }
    >();
    if (chatSessionIds.length > 0) {
      const channels = await this.prisma.chatChannel.findMany({
        where: { sessionId: { in: chatSessionIds } },
        select: { id: true, sessionId: true },
      });
      const sessionIdByChannelId = new Map(
        channels.map((c) => [c.id, c.sessionId as string]),
      );
      if (channels.length > 0) {
        const latest = await this.prisma.chatMessage.findMany({
          where: { channelId: { in: channels.map((c) => c.id) } },
          orderBy: [{ channelId: 'asc' }, { createdAt: 'desc' }],
          distinct: ['channelId'],
          select: {
            channelId: true,
            text: true,
            senderId: true,
            createdAt: true,
          },
        });
        for (const m of latest) {
          const sid = sessionIdByChannelId.get(m.channelId);
          if (sid) {
            lastMsgBySessionId.set(sid, {
              text: m.text,
              senderId: m.senderId,
              createdAt: m.createdAt,
            });
          }
        }
      }
    }

    const data = rowsPage.map((row) =>
      toSessionResponse(
        row,
        this.resolveAvatarUrl,
        undefined,
        lastMsgBySessionId.get(row.id) ?? null,
      ),
    );
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

  // ── ADMIN session browser ──────────────────────────────────────────────

  /** ADMIN — every session in the system, newest first, filterable by
   * status, type, and either party's display name. Not party-scoped. */
  async findAllAdmin(
    query: ListSessionsAdminDto,
  ): Promise<{ data: SessionResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const where: Prisma.SessionWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type }),
      AND: [
        ...(query.userId
          ? [{ OR: [{ aspirantId: query.userId }, { mentorId: query.userId }] }]
          : []),
        ...(query.search
          ? [
              {
                OR: [
                  {
                    aspirant: {
                      displayName: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                  {
                    mentor: {
                      displayName: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };

    const rows = await this.prisma.session.findMany({
      where,
      include: SESSION_WITH_NAMES_INCLUDE,
      orderBy: adminOrderBy(
        query.sortBy,
        query.sortDir,
        { requested: 'requestedAt', cost: 'totalCostMinor', status: 'status' },
        { requestedAt: 'desc' },
      ) as Prisma.SessionOrderByWithRelationInput[],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const rowsPage = hasMore ? rows.slice(0, take) : rows;
    return {
      data: rowsPage.map((row) => toSessionResponse(row, this.resolveAvatarUrl)),
      nextCursor: hasMore ? rowsPage[rowsPage.length - 1].id : null,
    };
  }

  /** ADMIN — one session, unscoped (any session id, not just ones the
   * caller is party to). */
  async findByIdAdmin(sessionId: string): Promise<SessionResponse> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: SESSION_WITH_NAMES_INCLUDE,
    });
    if (!session) {
      throw new NotFoundException(`Session '${sessionId}' not found`);
    }
    return toSessionResponse(session, this.resolveAvatarUrl);
  }

  /** ADMIN — the chat transcript for a CHAT session, cursor-paginated
   * newest-page-first via `before` (an older message id), same shape as
   * the participant-facing chat endpoint. Read-only: never provisions a
   * channel, so a session that was never opened just returns an empty
   * transcript rather than creating one as a side effect. Non-CHAT
   * sessions (audio calls) have no transcript and return empty. */
  async findMessagesAdmin(
    sessionId: string,
    before?: string,
  ): Promise<{
    messages: unknown[];
    hasMore: boolean;
    sessionType: SessionType;
    aspirantId: string;
    aspirantName: string;
    mentorId: string;
    mentorName: string;
  }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        type: true,
        aspirantId: true,
        mentorId: true,
        aspirant: { select: { displayName: true } },
        mentor: { select: { displayName: true } },
      },
    });
    if (!session) {
      throw new NotFoundException(`Session '${sessionId}' not found`);
    }
    const parties = {
      sessionType: session.type,
      aspirantId: session.aspirantId,
      aspirantName: session.aspirant.displayName,
      mentorId: session.mentorId,
      mentorName: session.mentor.displayName,
    };

    if (session.type !== SessionType.CHAT) {
      return { messages: [], hasMore: false, ...parties };
    }

    const channel = await this.prisma.chatChannel.findUnique({
      where: { sessionId },
      select: { id: true },
    });
    if (!channel) {
      return { messages: [], hasMore: false, ...parties };
    }

    const page = await this.chatService.listMessages(channel.id, before);
    return { ...page, ...parties };
  }

  /** ADMIN escape hatch for a session stuck in a non-terminal state — a call
   * that connected and never received an end event, or a request a mentor
   * never answered. Sets a terminal status + `ADMIN_CLOSED` reason and
   * releases any still-ACTIVE wallet hold, so an aspirant isn't left paying
   * for a call an admin had to kill before it connected. Deliberately does
   * NOT move already-settled money — a call that billed at connect stays
   * billed; use the reports / manual-refund flow for that. */
  async forceEndAdmin(sessionId: string): Promise<SessionResponse> {
    const session = await this.requireSession(sessionId);

    const TERMINAL: SessionStatus[] = [
      SessionStatus.COMPLETED,
      SessionStatus.REJECTED,
      SessionStatus.CANCELLED,
      SessionStatus.EXPIRED,
      SessionStatus.FAILED,
    ];
    if (TERMINAL.includes(session.status)) {
      throw new ConflictException(
        `Session is already finished (${session.status}) — nothing to force-end`,
      );
    }

    const nextStatus =
      session.status === SessionStatus.IN_PROGRESS
        ? SessionStatus.COMPLETED
        : SessionStatus.CANCELLED;

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: nextStatus,
        endedAt: new Date(),
        endReason: 'ADMIN_CLOSED',
      },
    });
    await this.releaseHoldsForSession(sessionId);
    this.logger.log(
      `[admin] force-ended session ${sessionId} (was ${session.status}) -> ${nextStatus}`,
    );

    return this.toResponseById(sessionId);
  }

  /** ADMIN bulk force-end — e.g. several sessions stuck from the same
   * incident (a push outage, a bad deploy). Deliberately a loop over the
   * single-session `forceEndAdmin` above rather than a raw bulk update:
   * each session needs its own terminal-status guard, its own next-status
   * derivation (COMPLETED vs. CANCELLED depends on that session's current
   * status), and its own wallet-hold release — a plain `updateMany` would
   * skip all of that. One already-finished or missing session in the batch
   * doesn't fail the rest; the caller gets back exactly which ids
   * succeeded vs. why one didn't. */
  async bulkForceEndAdmin(
    sessionIds: string[],
  ): Promise<{ ended: number; failed: { id: string; reason: string }[] }> {
    let ended = 0;
    const failed: { id: string; reason: string }[] = [];
    for (const id of sessionIds) {
      try {
        await this.forceEndAdmin(id);
        ended += 1;
      } catch (e) {
        failed.push({
          id,
          reason:
            e instanceof Error ? e.message : 'Could not force-end this session',
        });
      }
    }
    return { ended, failed };
  }

  /** Re-fetches a session with the aspirant/mentor names included — used
   * after every mutation instead of threading `include` through each
   * individual update() call. */
  private async toResponseById(sessionId: string): Promise<SessionResponse> {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      include: SESSION_WITH_NAMES_INCLUDE,
    });
    // Rating for the in-call context card the aspirant sees — cheap
    // (one indexed groupBy for a single mentor), and this path is a single
    // session, not the list.
    const mentorRating = await this.reviewsService.ratingSummary(
      session.mentorId,
    );
    return toSessionResponse(session, this.resolveAvatarUrl, mentorRating);
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

  /** Billing notifications must never break a settled call: the money has
   * already moved by the time these fire, so a failed in-app write or push
   * is logged and swallowed rather than bubbling a 500 back to the client. */
  private notifySafe(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, string>;
  }): Promise<unknown> {
    return this.notificationsService
      .send(params)
      .catch((err) => this.logger.warn(`[notify] billing notification failed: ${err}`));
  }

  /** Aspirant + mentor display names for a session, with safe fallbacks —
   * used only to personalise notification copy. */
  private async partyNames(
    aspirantId: string,
    mentorId: string,
  ): Promise<{ aspirantName: string; mentorName: string }> {
    const rows = await this.prisma.user.findMany({
      where: { id: { in: [aspirantId, mentorId] } },
      select: { id: true, displayName: true },
    });
    return {
      aspirantName: rows.find((r) => r.id === aspirantId)?.displayName ?? 'the student',
      mentorName: rows.find((r) => r.id === mentorId)?.displayName ?? 'your mentor',
    };
  }
}
