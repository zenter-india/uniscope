import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { BlocksModule } from '../blocks/blocks.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { SupportChatController } from './support-chat.controller.js';

/**
 * ChatModule owns channel provisioning and message persistence/delivery for
 * two independent things: CHAT-type Sessions (ChatController — a channel
 * exists only for the lifetime of its Session), and the persistent
 * per-user support channel (SupportChatController — available any time,
 * independent of any Session). Postgres (via Prisma) is the source of
 * truth for messages; Supabase Realtime Broadcast carries only a
 * content-free "new message" signal — see ChatService for why. Replaces
 * the earlier Stream Chat integration (migration/chat-supabase-realtime).
 * BlocksModule backs the block check in ChatController.sendMessage;
 * NotificationsModule backs ChatService's push+in-app "new message" ping.
 */
@Module({
  imports: [PrismaModule, BlocksModule, NotificationsModule],
  controllers: [ChatController, SupportChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
