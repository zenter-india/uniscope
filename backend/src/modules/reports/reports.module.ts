import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

/**
 * ReportsModule owns user-submitted reports (abuse, off-platform payment
 * requests, dropped calls, etc.) and their admin resolution — including the
 * manual Uniminute refund path for mentor-side call drops, which is
 * deliberately never automatic (see ReportsService).
 */
@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
