import { Module } from '@nestjs/common';
import { StreamVideoService } from './stream-video.service.js';

/** StreamVideoModule owns call provisioning + token issuance for
 * AUDIO_CALL sessions — replaces AgoraModule/LivekitModule. Room/call
 * lifecycle otherwise lives in SessionsService, which imports this module;
 * Stream Video itself has no local DB footprint, same as Agora/LiveKit
 * before it. */
@Module({
  providers: [StreamVideoService],
  exports: [StreamVideoService],
})
export class StreamVideoModule {}
