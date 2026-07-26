import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamChat } from 'stream-chat';

/** Fixed Stream identity for the "chat with UniScope" side of every support
 * channel — not a real User row, just a Stream user every support channel
 * shares as its other member. Whoever staffs support logs into Stream (or
 * the future admin panel) as this identity to reply. */
export const SUPPORT_ACCOUNT_ID = 'uniscope-support';
const SUPPORT_ACCOUNT_NAME = 'UniScope Support';

/**
 * Owns the Stream Chat server-side client. A Stream channel is created only
 * once a CHAT-type Session is ACCEPTED (see SessionsService.accept), keyed
 * by the session id — Stream is the source of truth for message delivery,
 * history, and offline sync; we only persist the channel id on the Session
 * row for authorization/lookup.
 *
 * Support channels (ensureSupportChannel) are a separate, session-
 * independent concept: every user gets exactly one persistent channel with
 * SUPPORT_ACCOUNT_ID, available any time regardless of session state — this
 * is what the "Need Help? Chat with our support team anytime" banner in the
 * app points at.
 */
@Injectable()
export class ChatService {
  private readonly client: StreamChat;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('stream.apiKey', '');
    const apiSecret = this.config.get<string>('stream.apiSecret', '');
    this.client = StreamChat.getInstance(this.apiKey, apiSecret);
  }

  getApiKey(): string {
    return this.apiKey;
  }

  generateUserToken(userId: string): string {
    return this.client.createToken(userId);
  }

  /** Idempotent, same pattern as ensureChannelForSession — safe to call on
   * every "open support chat" tap. */
  async ensureSupportChannel(userId: string): Promise<string> {
    const channelId = `support-${userId}`;

    await this.client.upsertUsers([
      { id: userId },
      { id: SUPPORT_ACCOUNT_ID, name: SUPPORT_ACCOUNT_NAME },
    ]);

    const channel = this.client.channel('messaging', channelId, {
      members: [userId, SUPPORT_ACCOUNT_ID],
      created_by_id: SUPPORT_ACCOUNT_ID,
    });
    await channel.create();

    return channelId;
  }

  /**
   * Idempotent — safe to call more than once for the same session (Stream's
   * channel.create is a create-or-return-existing by channel id).
   *
   * Passing each party's display name means Stream's own channel header
   * (StreamChannelHeader on the client) shows "who this chat is with"
   * instead of falling back to the raw user id — upsertUsers overwrites the
   * Stream-side user record's name every time, so a later display-name
   * change is picked up on the next chat open too.
   */
  async ensureChannelForSession(params: {
    sessionId: string;
    aspirantId: string;
    aspirantName: string;
    mentorId: string;
    mentorName: string;
  }): Promise<string> {
    const channelId = `session-${params.sessionId}`;

    await this.client.upsertUsers([
      { id: params.aspirantId, name: params.aspirantName },
      { id: params.mentorId, name: params.mentorName },
    ]);

    const channel = this.client.channel('messaging', channelId, {
      members: [params.aspirantId, params.mentorId],
      created_by_id: params.mentorId,
    });
    await channel.create();

    return channelId;
  }
}
