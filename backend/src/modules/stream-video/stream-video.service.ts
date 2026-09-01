import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamClient } from '@stream-io/node-sdk';
import type { StreamConfig } from '../../config/index.js';

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour — well past any single call slot

/** Call type pre-configured (via the Stream dashboard, same account as
 * Stream Chat) with video permanently disabled — every call this app makes
 * is a 1:1 audio-only session, never video (anonymity model, see
 * SessionType comment on the Prisma schema). */
const CALL_TYPE = 'audio_room';

/**
 * Owns Stream Video call provisioning + token generation for AUDIO_CALL
 * sessions. Replaces AgoraService/LivekitService — reuses the same Stream
 * account/credentials (STREAM_API_KEY/STREAM_API_SECRET) already used for
 * Stream Chat, since Stream Video is billed and authenticated on the same
 * API key, just a different product surface.
 */
@Injectable()
export class StreamVideoService {
  private readonly client: StreamClient;

  constructor(private readonly config: ConfigService) {
    const cfg = this.config.get<StreamConfig>('stream')!;
    this.client = new StreamClient(cfg.apiKey, cfg.apiSecret);
  }

  getApiKey(): string {
    return this.config.get<StreamConfig>('stream')!.apiKey;
  }

  getCallCid(callId: string): string {
    return `${CALL_TYPE}:${callId}`;
  }

  /**
   * Idempotent — same "create-or-return-existing" pattern as
   * ChatService.ensureChannelForSession. Upserts both parties as Stream
   * users first (call members must already exist), same invariant Chat
   * already holds for these two users.
   */
  async ensureCall(params: {
    callId: string;
    aspirantId: string;
    aspirantName: string;
    mentorId: string;
    mentorName: string;
  }): Promise<void> {
    await this.client.upsertUsers([
      { id: params.aspirantId, name: params.aspirantName },
      { id: params.mentorId, name: params.mentorName },
    ]);

    const call = this.client.video.call(CALL_TYPE, params.callId);
    await call.getOrCreate({
      data: {
        created_by_id: params.mentorId,
        members: [
          { user_id: params.aspirantId },
          { user_id: params.mentorId },
        ],
      },
    });
  }

  /** Call-scoped token — restricted to this one call_cid via call_cids,
   * same never-a-shared/app-wide-token invariant AgoraService/LivekitService
   * held before this. */
  generateCallToken(userId: string, callId: string): string {
    return this.client.generateCallToken({
      user_id: userId,
      call_cids: [this.getCallCid(callId)],
      validity_in_seconds: TOKEN_TTL_SECONDS,
    });
  }
}
