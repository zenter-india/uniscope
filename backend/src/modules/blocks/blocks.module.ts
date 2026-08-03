import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { AvatarModule } from '../avatar/avatar.module.js';
import { BlocksController } from './blocks.controller.js';
import { BlocksService } from './blocks.service.js';

/**
 * BlocksModule owns one-directional user blocking. Enforced at session
 * creation (see SessionsService.create, which imports BlocksService) —
 * blocking someone (or being blocked by them) prevents new chat/call
 * sessions in either direction, but doesn't touch existing chat history.
 */
@Module({
  imports: [PrismaModule, AvatarModule],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
