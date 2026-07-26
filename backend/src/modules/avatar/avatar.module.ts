import { Global, Module } from '@nestjs/common';
import { AvatarService } from './avatar.service.js';

/** Global because avatars are attached to users, mentors and sessions —
 * almost every response projection needs to resolve an avatar URL. */
@Global()
@Module({
  providers: [AvatarService],
  exports: [AvatarService],
})
export class AvatarModule {}
