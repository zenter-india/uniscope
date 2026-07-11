import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { WalletController } from './wallet.controller.js';
import { WalletService } from './wallet.service.js';

/**
 * WalletModule owns balance, ledger history, and Razorpay-backed topups.
 * WalletService.applyLedgerEntry is exported for reuse by session billing
 * once the Agora/BullMQ billing clock is wired in — no other module should
 * write to the ledger directly.
 */
@Module({
  imports: [PrismaModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
