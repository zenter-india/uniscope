import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { SupportChatController } from './support-chat.controller.js';

/**
 * ChatModule owns Stream Chat channel provisioning and token issuance for
 * two independent things: CHAT-type Sessions (ChatController — a channel
 * exists only for the lifetime of its Session), and the persistent
 * per-user support channel (SupportChatController — available any time,
 * independent of any Session). Stream is the source of truth for message
 * delivery, history, and offline sync in both cases.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ChatController, SupportChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
