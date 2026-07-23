import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { PayoutsController } from './payouts.controller.js';
import { PayoutsService } from './payouts.service.js';

/**
 * PayoutsModule computes what each mentor is owed (derived from
 * SESSION_CREDIT ledger history, never mentor-chosen) and lets an admin
 * manually confirm a bank transfer, debiting the mentor's Uniminute wallet
 * only once that's confirmed. Disbursement itself stays fully manual by
 * deliberate architecture decision — see PayoutsService.
 */
@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
