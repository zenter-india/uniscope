import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatChannel, ChatChannelType } from '@prisma/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/index.js';
import type { SupabaseConfig } from '../../config/index.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '@prisma/client';
import { ChatMessageResponse, toChatMessageResponse } from './chat-message-response.js';

/** Fixed identity for the "chat with UniScope" side of every support
 * channel — not a real User row, just a sentinel sender id every support
 * channel shares. Whoever staffs support replies as this identity (via the
 * future admin panel) — kept identical to the pre-migration Stream Chat
 * convention so nothing about the support-chat product behavior changes. */
export const SUPPORT_ACCOUNT_ID = 'uniscope-support';

/** How many messages one page returns, newest-first internally then
 * reversed to chronological order for the client. Applies to both the
 * initial (no cursor) page and every `before`-cursor page. */
const MESSAGE_PAGE_SIZE = 50;

export interface MessagePage {
  messages: ChatMessageResponse[];
  /** True if there are older messages beyond this page — the client should
   * show a "load more" affordance and pass the oldest message's id as
   * `before` to fetch the next page. */
  hasMore: boolean;
}

/** One row of the admin support inbox — the user behind a SUPPORT channel
 * plus a preview of where the conversation stands. */
export interface SupportChannelSummary {
  channelId: string;
  userId: string;
  displayName: string;
  uniqueId: string | null;
  role: string | null;
  messageCount: number;
  lastMessageText: string | null;
  lastMessageAt: Date;
  /** True when the most recent message came from the support sentinel
   * (staff), false when it came from the real user. */
  lastMessageFromStaff: boolean;
  /** True when the last message is from the user and still unanswered —
   * what the admin inbox sorts/badges on. */
  awaitingReply: boolean;
}

/**
 * Owns chat channel provisioning, message persistence, and live-delivery
 * signaling. Replaces Stream Chat (see migration/chat-supabase-realtime) —
 * Postgres (via Prisma) is now the source of truth for messages; Supabase
 * Realtime Broadcast carries only a content-free "new message" ping per
 * channel, so a client knows to refetch — the message body is never put on
 * the wire outside the authenticated REST API. This sidesteps needing
 * per-row Postgres RLS/Realtime-auth integration for this app's custom
 * phone-OTP+JWT auth (no native Supabase Auth session to hand Realtime).
 */
@Injectable()
export class ChatService {
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {
    const cfg = this.config.get<SupabaseConfig>('supabase')!;
    this.supabaseUrl = cfg.url;
    this.supabaseAnonKey = cfg.anonKey;
  }

  /** The Realtime Broadcast topic for a channel — mobile subscribes here
   * with the public anon key (safe: the topic carries no message content,
   * only a "something changed, go refetch" signal). */
  broadcastTopic(channelId: string): string {
    return `chat:${channelId}`;
  }

  /** Everything a client needs to open a channel: connection info plus the
   * first page of history, in one round trip. */
  connectionInfo(channelId: string): { supabaseUrl: string; supabaseAnonKey: string; broadcastTopic: string } {
    return {
      supabaseUrl: this.supabaseUrl,
      supabaseAnonKey: this.supabaseAnonKey,
      broadcastTopic: this.broadcastTopic(channelId),
    };
  }

  /** Idempotent — same create-or-return-existing pattern the Stream Chat
   * version held (channel.create() there, upsert-by-sessionId here). */
  async ensureChannelForSession(sessionId: string): Promise<ChatChannel> {
    const existing = await this.prisma.chatChannel.findUnique({ where: { sessionId } });
    if (existing) return existing;

    return this.prisma.chatChannel.create({
      data: { type: ChatChannelType.SESSION, sessionId },
    });
  }

  /** Idempotent — safe to call on every "open support chat" tap, same as
   * before. */
  async ensureSupportChannel(userId: string): Promise<ChatChannel> {
    const existing = await this.prisma.chatChannel.findUnique({
      where: { supportUserId: userId },
    });
    if (existing) return existing;

    return this.prisma.chatChannel.create({
      data: { type: ChatChannelType.SUPPORT, supportUserId: userId },
    });
  }

  /** The admin support inbox — every SUPPORT channel that has at least one
   * message, newest activity first, each with the user behind it and a
   * preview of the last message. Channels that were lazily provisioned by a
   * "GET messages" open but never actually used are excluded. */
  async listSupportChannels(): Promise<SupportChannelSummary[]> {
    const channels = await this.prisma.chatChannel.findMany({
      where: { type: ChatChannelType.SUPPORT },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
    });

    const userIds = channels
      .map((c) => c.supportUserId)
      .filter((v): v is string => !!v);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, uniqueId: true, role: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return channels
      .filter((c) => c.supportUserId && c._count.messages > 0)
      .map((c) => {
        const last = c.messages[0];
        const u = userMap.get(c.supportUserId!);
        const fromStaff = last ? last.senderId === SUPPORT_ACCOUNT_ID : false;
        return {
          channelId: c.id,
          userId: c.supportUserId!,
          displayName: u?.displayName ?? 'Unknown user',
          uniqueId: u?.uniqueId ?? null,
          role: u?.role ?? null,
          messageCount: c._count.messages,
          lastMessageText: last?.text ?? null,
          lastMessageAt: last?.createdAt ?? c.createdAt,
          lastMessageFromStaff: fromStaff,
          awaitingReply: last ? !fromStaff : false,
        };
      })
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  /** Read one user's support thread (admin side). Provisions the channel if
   * the user has somehow never opened support — harmless, same idempotent
   * path the user's own GET uses. */
  async getSupportThreadForUser(
    userId: string,
    before?: string,
  ): Promise<MessagePage & { channelId: string }> {
    const channel = await this.ensureSupportChannel(userId);
    const page = await this.listMessages(channel.id, before);
    return { ...page, channelId: channel.id };
  }

  /** Post a staff reply into a user's support thread, sent as the
   * SUPPORT_ACCOUNT_ID sentinel so it renders on the "UniScope Support"
   * side for the user. Runs through the same sendMessage path as any other
   * message, so the user gets the in-app + push "new message" notification
   * (see notifyOthers) and any connected client refetches. */
  async sendSupportReply(
    userId: string,
    text: string,
    clientMessageId?: string,
  ): Promise<ChatMessageResponse> {
    const channel = await this.ensureSupportChannel(userId);
    return this.sendMessage(channel.id, SUPPORT_ACCOUNT_ID, text, clientMessageId);
  }

  /**
   * Cursor-paginated: no `before` returns the latest page; `before=<id>`
   * returns the page immediately older than that message. Internally
   * always queries newest-first (so `take`/cursor work against a stable,
   * indexed order — `(channelId, createdAt)`) then reverses to
   * chronological order for the client. Fetches one extra row past the
   * page size to determine `hasMore` without a separate count query.
   */
  async listMessages(channelId: string, before?: string): Promise<MessagePage> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: MESSAGE_PAGE_SIZE + 1,
      ...(before && { cursor: { id: before }, skip: 1 }),
    });

    const hasMore = messages.length > MESSAGE_PAGE_SIZE;
    const page = hasMore ? messages.slice(0, MESSAGE_PAGE_SIZE) : messages;
    // findMany with orderBy desc gives "the latest/next N" — reverse back
    // to chronological order for the client's message list.
    return { messages: page.reverse().map(toChatMessageResponse), hasMore };
  }

  /**
   * Persists the message, then either notifies the other participant(s)
   * (push + in-app) and pings Realtime, or — if `clientMessageId` matches
   * an already-persisted message on this channel — returns that existing
   * row untouched: no second insert, no duplicate notification, no
   * redundant Realtime ping. This is what makes a retried/double-tapped
   * send safe.
   */
  async sendMessage(
    channelId: string,
    senderId: string,
    text: string,
    clientMessageId?: string,
  ): Promise<ChatMessageResponse> {
    if (clientMessageId) {
      const existing = await this.prisma.chatMessage.findUnique({
        where: { channelId_clientMessageId: { channelId, clientMessageId } },
      });
      if (existing) return toChatMessageResponse(existing);
    }

    const message = await this.prisma.chatMessage.create({
      data: { channelId, senderId, text, clientMessageId },
    });

    await Promise.all([
      this.publishNewMessage(channelId),
      this.notifyOthers(channelId, senderId, text),
    ]);

    return toChatMessageResponse(message);
  }

  /** Content-free ping so any connected client refetches — deliberately
   * never carries the message body (see class doc). httpSend() posts a
   * single REST request, no persistent socket held by this stateless
   * backend (available since supabase-js 2.107.0). Best-effort: a failed
   * ping just means a client relies on its own poll/refresh instead of
   * catching this instantly — never blocks the send itself. */
  private async publishNewMessage(channelId: string): Promise<void> {
    try {
      const channel = this.supabase.channel(this.broadcastTopic(channelId));
      await channel.httpSend('new_message', {});
      this.supabase.removeChannel(channel);
    } catch {
      // best-effort — see doc comment above.
    }
  }

  /** Push + in-app notification for whoever didn't just send this message.
   * Best-effort — NotificationsService already swallows push failures
   * internally (see its doc comment), and a failure here must never block
   * the send itself, so this is wrapped defensively too. On a SUPPORT
   * channel only a staff reply (sent as SUPPORT_ACCOUNT_ID) notifies
   * anyone — the real user; a message the user sent *to* support has no
   * "support" User row to push to. */
  private async notifyOthers(
    channelId: string,
    senderId: string,
    text: string,
  ): Promise<void> {
    try {
      const channel = await this.prisma.chatChannel.findUnique({
        where: { id: channelId },
        include: {
          session: { select: { id: true, aspirantId: true, mentorId: true } },
        },
      });
      if (!channel) return;

      let recipientIds: string[] = [];
      if (channel.type === ChatChannelType.SESSION && channel.session) {
        recipientIds = [
          channel.session.aspirantId,
          channel.session.mentorId,
        ].filter((id) => id !== senderId);
      } else if (
        channel.type === ChatChannelType.SUPPORT &&
        channel.supportUserId
      ) {
        recipientIds =
          senderId === SUPPORT_ACCOUNT_ID ? [channel.supportUserId] : [];
      }

      // sessionId (not channelId) is the key the mobile notification-tap
      // handler already reads (NotificationResponse.sessionId — see
      // notifications_api.dart) to deep-link into the right chat; a
      // SUPPORT channel has no session, so its notifications just surface
      // without a deep link, same as any other non-session notification.
      const preview = text.length > 80 ? `${text.slice(0, 80)}…` : text;
      await Promise.all(
        recipientIds.map((userId) =>
          this.notifications.send({
            userId,
            type: NotificationType.MESSAGE,
            title: 'New message',
            body: preview,
            metadata: channel.session
              ? { sessionId: channel.session.id }
              : undefined,
          }),
        ),
      );
    } catch {
      // best-effort — see doc comment above.
    }
  }
}
