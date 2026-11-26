import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { AdminMoneyController } from './admin-money.controller.js';
import { MoneyAnalyticsService } from './money-analytics.service.js';
import { MoneyService } from './money.service.js';

/** Read-only money reporting (top-ups by platform, mentor earnings, trends,
 * payers, balances, call usage) for the admin Money page. Writes nothing;
 * reads the append-only ledger and the session list. */
@Module({
  imports: [PrismaModule],
  controllers: [AdminMoneyController],
  providers: [MoneyService, MoneyAnalyticsService],
})
export class MoneyModule {}
