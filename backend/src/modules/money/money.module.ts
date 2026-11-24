import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { AdminMoneyController } from './admin-money.controller.js';
import { MoneyService } from './money.service.js';

/** Read-only money reporting (top-ups by platform, mentor earnings) for the
 * admin Money page. Writes nothing; reads the append-only ledger. */
@Module({
  imports: [PrismaModule],
  controllers: [AdminMoneyController],
  providers: [MoneyService],
})
export class MoneyModule {}
