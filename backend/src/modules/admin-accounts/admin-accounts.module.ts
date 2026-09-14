import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import {
  AdminAccountsAuthController,
  AdminAccountsController,
} from './admin-accounts.controller.js';
import { AdminAccountsService } from './admin-accounts.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AdminAccountsController, AdminAccountsAuthController],
  providers: [AdminAccountsService],
})
export class AdminAccountsModule {}
