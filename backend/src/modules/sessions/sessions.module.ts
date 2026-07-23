import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { AgoraModule } from '../agora/agora.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { MentorsModule } from '../mentors/mentors.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

/**
 * SessionsModule owns the booking + call lifecycle. Depends on MentorsModule
 * to reuse the single source of truth for "is this mentor bookable," on
 * ChatModule to provision the Stream channel for CHAT-type sessions on
 * accept, on WalletModule to place/consume/release the Uniminute holds that
 * back AUDIO_CALL slot billing, on AgoraModule for RTC token issuance, and
 * on NotificationsModule to push-notify the other party on request/accept/
 * reject (a marketplace where mentors only find out about requests by
 * opening the app doesn't actually function).
 */
@Module({
  imports: [
    PrismaModule,
    MentorsModule,
    ChatModule,
    WalletModule,
    AgoraModule,
    NotificationsModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
