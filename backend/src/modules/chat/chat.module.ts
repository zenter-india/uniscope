import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

/**
 * ChatModule owns Stream Chat channel provisioning and token issuance for
 * CHAT-type Sessions. A channel exists only for the lifetime of its Session
 * — there is no standalone/persistent chat room outside the billed session
 * flow. Stream is the source of truth for message delivery, history, and
 * offline sync.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
