import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { VerificationController } from './verification.controller.js';
import { VerificationService } from './verification.service.js';

/**
 * VerificationModule owns mentor/aspirant identity verification: document
 * submission (uploaded to the global SupabaseModule's storage client),
 * admin review queue, status transitions
 * (DRAFT → SUBMITTED → UNDER_REVIEW → VERIFIED/REJECTED), and notifying the
 * user on the review outcome. SupabaseModule is @Global() so it doesn't
 * need to be imported here explicitly.
 */
@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
