import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BroadcastsController } from './broadcasts.controller.js';
import { BroadcastsService } from './broadcasts.service.js';

/** ADMIN broadcast announcements — see BroadcastsService. Reuses
 * NotificationsService.sendBulk for the fan-out (in-app rows + push). */
@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [BroadcastsController],
  providers: [BroadcastsService],
})
export class BroadcastsModule {}
