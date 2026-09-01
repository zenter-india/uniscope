import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatChannel, ChatChannelType } from '@prisma/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/index.js';
import type { SupabaseConfig } from '../../config/index.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { ChatMessageResponse, toChatMessageResponse } from './chat-message-response.js';

/** Fixed identity for the "chat with UniScope" side of every support
 * channel — not a real User row, just a sentinel sender id every support
 * channel shares. Whoever staffs support replies as this identity (via the
 * future admin panel) — kept identical to the pre-migration Stream Chat
 * convention so nothing about the support-chat product behavior changes. */
export const SUPPORT_ACCOUNT_ID = 'uniscope-support';

/** How many recent messages a channel-open loads in one page. No older-
 * history pagination yet (see the scope note in the CLAUDE.md history for
 * this migration) — a deliberate v1 simplification, fine at this app's
 * message volumes; add a cursor if/when a channel outgrows one page. */
const MESSAGE_PAGE_SIZE = 50;

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

  async listMessages(channelId: string): Promise<ChatMessageResponse[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: MESSAGE_PAGE_SIZE,
    });
    // findMany with orderBy desc + take gives "the latest N" — reverse back
    // to chronological order for the client's message list.
    return messages.reverse().map(toChatMessageResponse);
  }

  async sendMessage(
    channelId: string,
    senderId: string,
    text: string,
  ): Promise<ChatMessageResponse> {
    const message = await this.prisma.chatMessage.create({
      data: { channelId, senderId, text },
    });
    await this.publishNewMessage(channelId);
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
}
