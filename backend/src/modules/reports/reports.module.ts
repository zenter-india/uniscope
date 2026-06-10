import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';

/**
 * ReportsModule owns the content moderation feature domain:
 * user-submitted reports on questions, answers, reviews, messages,
 * and other users; admin moderation queue; report status transitions;
 * and automated flagging thresholds (future).
 */
@Module({
  imports: [PrismaModule],
  controllers: [], // Sprint 3: add ReportsController
  providers: [], // Sprint 3: add ReportsService
  exports: [],
})
export class ReportsModule {}
