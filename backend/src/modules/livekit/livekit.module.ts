import { Module } from '@nestjs/common';
import { LivekitService } from './livekit.service.js';

/** LivekitModule owns access-token generation for AUDIO_CALL sessions —
 * replaces AgoraModule. Room provisioning and connect confirmation live in
 * SessionsService, which imports this module; LiveKit itself has no local
 * DB footprint, same as Agora before it. */
@Module({
  providers: [LivekitService],
  exports: [LivekitService],
})
export class LivekitModule {}
