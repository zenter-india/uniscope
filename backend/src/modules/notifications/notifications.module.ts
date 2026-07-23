import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

/**
 * NotificationsModule owns in-app and push notification delivery: creating
 * notification records, marking as read, unread-count queries, push-token
 * registration, and FCM push dispatch (using the global FirebaseModule).
 * Exported so other modules (Sessions, Reports, ...) can inject
 * NotificationsService to fire notifications on domain events.
 */
@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
