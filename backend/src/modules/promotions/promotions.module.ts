import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import {
  AdminPromotionsController,
  PromotionsController,
} from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

/** Admin "Promotions": a popup message (plus the usual notification) with an
 * optional https link and an optional wallet credit. Credits go through
 * WalletService.applyLedgerEntry like every other balance change. */
@Module({
  imports: [PrismaModule, NotificationsModule, WalletModule],
  controllers: [AdminPromotionsController, PromotionsController],
  providers: [PromotionsService],
})
export class PromotionsModule {}
