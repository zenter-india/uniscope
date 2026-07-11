import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamChat } from 'stream-chat';

/**
 * Owns the Stream Chat server-side client. A Stream channel is created only
 * once a CHAT-type Session is ACCEPTED (see SessionsService.accept), keyed
 * by the session id — Stream is the source of truth for message delivery,
 * history, and offline sync; we only persist the channel id on the Session
 * row for authorization/lookup.
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

  /**
   * Idempotent — safe to call more than once for the same session (Stream's
   * channel.create is a create-or-return-existing by channel id).
   */
  async ensureChannelForSession(params: {
    sessionId: string;
    aspirantId: string;
    mentorId: string;
  }): Promise<string> {
    const channelId = `session-${params.sessionId}`;

    await this.client.upsertUsers([{ id: params.aspirantId }, { id: params.mentorId }]);

    const channel = this.client.channel('messaging', channelId, {
      members: [params.aspirantId, params.mentorId],
      created_by_id: params.mentorId,
    });
    await channel.create();

    return channelId;
  }
}
