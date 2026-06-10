import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';

/**
 * NotificationsModule owns in-app and push notification delivery:
 * creating notification records, marking as read, unread-count queries,
 * Firebase FCM push dispatch (using the global FirebaseModule),
 * and notification preference management (future).
 */
@Module({
  imports: [PrismaModule],
  controllers: [], // Sprint 3: add NotificationsController
  providers: [], // Sprint 3: add NotificationsService
  exports: [],
})
export class NotificationsModule {}
