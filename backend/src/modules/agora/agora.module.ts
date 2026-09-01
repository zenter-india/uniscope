import { Module } from '@nestjs/common';
import { AgoraService } from './agora.service.js';

/** AgoraModule owns RTC token generation for AUDIO_CALL sessions. Channel
 * provisioning and connect confirmation live in SessionsService, which
 * imports this module — Agora itself has no local DB footprint. */
@Module({
  providers: [AgoraService],
  exports: [AgoraService],
})
export class AgoraModule {}
