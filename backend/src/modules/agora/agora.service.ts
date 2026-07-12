import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RtcRole, RtcTokenBuilder } from 'agora-token';
import type { AgoraConfig } from '../../config/index.js';

const TOKEN_EXPIRE_SECONDS = 60 * 60; // 1 hour — well past any single call slot

/**
 * Owns Agora RTC token generation for AUDIO_CALL sessions. Tokens are
 * scoped to a single channel (the session's agoraChannelName) and a single
 * user account (the caller's own userId, kept as a string account rather
 * than mapping to an integer uid) — never a shared/app-wide token.
 */
@Injectable()
export class AgoraService {
  private readonly cfg: AgoraConfig;

  constructor(private readonly config: ConfigService) {
    this.cfg = this.config.get<AgoraConfig>('agora')!;
  }

  getAppId(): string {
    return this.cfg.appId;
  }

  generateRtcToken(channelName: string, userId: string): string {
    return RtcTokenBuilder.buildTokenWithUserAccount(
      this.cfg.appId,
      this.cfg.appCertificate,
      channelName,
      userId,
      RtcRole.PUBLISHER,
      TOKEN_EXPIRE_SECONDS,
      TOKEN_EXPIRE_SECONDS,
    );
  }
}
