import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { AdminTechnicalReportsController } from './admin-technical-reports.controller.js';
import { TechnicalReportsController } from './technical-reports.controller.js';
import { TechnicalReportsService } from './technical-reports.service.js';

/** "Report a technical issue" from the Help Centre — a flat bug queue,
 * separate from ReportsModule (member/session moderation). User-facing
 * POST + ADMIN list/resolve. */
@Module({
  imports: [PrismaModule],
  controllers: [TechnicalReportsController, AdminTechnicalReportsController],
  providers: [TechnicalReportsService],
})
export class TechnicalReportsModule {}
