import { Module } from '@nestjs/common';
import { SlackNotifierModule } from '../../common/slack/slack-notifier.module.js';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';

/**
 * EnrollmentsModule captures pre-registrations from the public marketing site
 * (`web/`) into the standalone EnrollmentLead table — people who have shown
 * interest but have no account yet — and gives admins the queue, CSV export
 * and convert-to-account linkage on top of it. SupabaseModule is @Global(), so
 * the college-ID upload path needs no explicit import here.
 */
@Module({
  imports: [PrismaModule, SlackNotifierModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
