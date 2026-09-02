import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';

/** Read-only aggregate metrics for the admin dashboard Overview. */
@Module({
  imports: [PrismaModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
