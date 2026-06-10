import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';

/**
 * ChatModule owns the 1:1 messaging feature domain:
 * chat room creation (prospective student → verified mentor),
 * real-time message delivery via WebSocket gateway,
 * read-receipts, media attachments (Supabase Storage),
 * inbox/unread-count queries, and block/close room actions.
 */
@Module({
  imports: [PrismaModule],
  controllers: [], // Sprint 3: add ChatController
  providers: [], // Sprint 3: add ChatService, ChatGateway (WebSocket)
  exports: [],
})
export class ChatModule {}
