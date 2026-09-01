import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import type { LivekitConfig } from '../../config/index.js';

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour — well past any single call slot

/**
 * Owns LiveKit access-token generation for AUDIO_CALL sessions. Replaces
 * AgoraService (see migration/supabase-chat-livekit-calls branch) — tokens
 * are scoped to a single room (the session's call room name) and a single
 * participant identity (the caller's own userId), never a shared/app-wide
 * token, same invariant AgoraService held.
 */
@Injectable()
export class LivekitService {
  private readonly cfg: LivekitConfig;

  constructor(private readonly config: ConfigService) {
    this.cfg = this.config.get<LivekitConfig>('livekit')!;
  }

  getServerUrl(): string {
    return this.cfg.serverUrl;
  }

  /** LiveKit tokens are signed JWTs scoped by grant, not a channel+cert
   * pairing like Agora's — roomJoin grants exactly the one room, matching
   * the single-channel-per-session invariant the old AgoraService held. */
  async generateAccessToken(roomName: string, userId: string): Promise<string> {
    const at = new AccessToken(this.cfg.apiKey, this.cfg.apiSecret, {
      identity: userId,
      ttl: TOKEN_TTL_SECONDS,
    });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    return at.toJwt();
  }
}
